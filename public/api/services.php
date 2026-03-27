<?php
/**
 * Services API Endpoint - Protected with Authentication
 * Optimized file upload with security validation
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
AuthMiddleware::requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;

    case 'POST':
        handlePost($pdo);
        break;

    case 'PUT':
        handlePut($pdo);
        break;

    case 'DELETE':
        handleDelete($pdo);
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - List services
 */
function handleGet(PDO $pdo): void {
    $withProducts = isset($_GET['with_products']);
    
    try {
        if ($withProducts) {
            // Optimized: Get services with products in one query
            $sql = "
                SELECT 
                    s.id as service_id,
                    s.name as service_name,
                    s.description,
                    s.image_url,
                    p.id as product_id,
                    p.name as product_name,
                    p.price,
                    p.billing_cycle
                FROM services s
                LEFT JOIN products p ON s.id = p.service_id
                ORDER BY s.id, p.id
            ";
            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll();
            
            // Group products by service
            $services = [];
            foreach ($rows as $row) {
                $serviceId = $row['service_id'];
                
                if (!isset($services[$serviceId])) {
                    $services[$serviceId] = [
                        'id' => $serviceId,
                        'name' => $row['service_name'],
                        'description' => $row['description'],
                        'image_url' => $row['image_url'],
                        'products' => []
                    ];
                }
                
                if ($row['product_id']) {
                    $services[$serviceId]['products'][] = [
                        'id' => $row['product_id'],
                        'name' => $row['product_name'],
                        'price' => (float) $row['price'],
                        'billing_cycle' => $row['billing_cycle']
                    ];
                }
            }
            
            ApiResponse::success(['items' => array_values($services)]);
            
        } else {
            $stmt = $pdo->query("SELECT * FROM services ORDER BY id");
            $services = $stmt->fetchAll();
            ApiResponse::success(['items' => $services]);
        }
        
    } catch (PDOException $e) {
        error_log('Error fetching services: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch services');
    }
}

/**
 * Handle POST request - Create or Update service with secure file upload
 */
function handlePost(PDO $pdo): void {
    ini_set('display_errors', 0);
    
    // Handle file upload with security validation
    $imageUrl = null;
    
    if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
        $imageUrl = handleFileUpload($_FILES['image']);
        if ($imageUrl === false) {
            return; // Error already sent
        }
    }
    
    // Handle data
    $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('name', 'Service name is required')
        ->length('name', 2, 255)
        ->length('description', 0, 2000);
    
    $validator->throwIfFailed();
    
    $name = InputValidator::sanitize($data['name']);
    $description = $data['description'] ? InputValidator::sanitize($data['description']) : null;
    
    try {
        // Update existing
        if (!empty($data['id'])) {
            $id = (int) $data['id'];
            
            // Check existence
            $stmt = $pdo->prepare("SELECT id FROM services WHERE id = ?");
            $stmt->execute([$id]);
            if (!$stmt->fetch()) {
                ApiResponse::notFound('Service');
                return;
            }
            
            // Build update query
            $sql = "UPDATE services SET name = ?, description = ?";
            $params = [$name, $description];
            
            if ($imageUrl) {
                // Delete old image if exists
                deleteOldImage($pdo, $id);
                $sql .= ", image_url = ?";
                $params[] = $imageUrl;
            }
            
            $sql .= " WHERE id = ?";
            $params[] = $id;
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            ApiResponse::success([
                'id' => $id,
                'message' => 'Service updated successfully'
            ]);
            
        } else {
            // Create new
            $stmt = $pdo->prepare("
                INSERT INTO services (name, description, image_url) 
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$name, $description, $imageUrl]);
            
            $id = $pdo->lastInsertId();
            
            ApiResponse::success([
                'id' => $id,
                'name' => $name,
                'message' => 'Service created successfully'
            ], 201);
        }
        
    } catch (PDOException $e) {
        error_log('Error saving service: ' . $e->getMessage());
        ApiResponse::serverError('Failed to save service');
    }
}

/**
 * Handle PUT request - Update via JSON (legacy support)
 */
function handlePut(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $validator = new InputValidator($data);
    $validator
        ->required('id')
        ->required('name')
        ->length('name', 2, 255);
    
    $validator->throwIfFailed();
    
    $id = (int) $data['id'];
    $name = InputValidator::sanitize($data['name']);
    $description = $data['description'] ? InputValidator::sanitize($data['description']) : null;
    $imageUrl = $data['image_url'] ?? null;
    
    try {
        $stmt = $pdo->prepare("SELECT id FROM services WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            ApiResponse::notFound('Service');
            return;
        }
        
        $stmt = $pdo->prepare("
            UPDATE services 
            SET name = ?, description = ?, image_url = ? 
            WHERE id = ?
        ");
        $stmt->execute([$name, $description, $imageUrl, $id]);
        
        ApiResponse::success(['message' => 'Service updated successfully']);
        
    } catch (PDOException $e) {
        error_log('Error updating service: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update service');
    }
}

/**
 * Handle DELETE request - Delete service
 */
function handleDelete(PDO $pdo): void {
    $id = InputValidator::int($_GET['id'] ?? null);
    
    if (!$id) {
        ApiResponse::error('Service ID is required', 400);
        return;
    }
    
    try {
        // Check for associated products with subscriptions
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM subscriptions s
            JOIN products p ON s.product_id = p.id
            WHERE p.service_id = ?
        ");
        $stmt->execute([$id]);
        $subscriptionCount = $stmt->fetchColumn();
        
        if ($subscriptionCount > 0) {
            ApiResponse::error(
                'Cannot delete service with active subscriptions. Please delete subscriptions first.', 
                409
            );
            return;
        }
        
        // Delete old image
        deleteOldImage($pdo, $id);
        
        $stmt = $pdo->prepare("DELETE FROM services WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            ApiResponse::notFound('Service');
            return;
        }
        
        ApiResponse::success(['message' => 'Service deleted successfully']);
        
    } catch (PDOException $e) {
        error_log('Error deleting service: ' . $e->getMessage());
        ApiResponse::serverError('Failed to delete service');
    }
}

/**
 * Handle file upload with comprehensive security checks
 * 
 * @param array $file $_FILES['image']
 * @return string|false URL path or false on error
 */
function handleFileUpload(array $file): string|false {
    // Check upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = match ($file['error']) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds server limit',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form limit',
            UPLOAD_ERR_PARTIAL => 'File partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file',
            UPLOAD_ERR_EXTENSION => 'Upload stopped by extension',
            default => 'Unknown upload error'
        };
        ApiResponse::error($errorMsg, 400);
        return false;
    }
    
    // Validate file size (max 2MB)
    $maxSize = 2 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        ApiResponse::error('File too large. Maximum size is 2MB', 400);
        return false;
    }
    
    // Validate MIME type with finfo (most reliable)
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!in_array($mimeType, $allowedMimes)) {
        ApiResponse::error('Invalid file type. Only JPEG, PNG, GIF, and WebP allowed', 400);
        return false;
    }
    
    // Validate extension
    $extension = match ($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        default => null
    };
    
    if (!$extension) {
        ApiResponse::error('Invalid image format', 400);
        return false;
    }
    
    // Create upload directory with secure permissions
    $uploadDir = __DIR__ . '/../uploads/services/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            error_log('Failed to create upload directory: ' . $uploadDir);
            ApiResponse::serverError('Upload directory creation failed');
            return false;
        }
    }
    
    // Generate cryptographically secure filename
    $filename = bin2hex(random_bytes(16)) . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        error_log('Failed to move uploaded file to: ' . $filepath);
        ApiResponse::serverError('File upload failed');
        return false;
    }
    
    // Set secure file permissions
    chmod($filepath, 0644);
    
    return '/uploads/services/' . $filename;
}

/**
 * Delete old image file when updating/deleting service
 */
function deleteOldImage(PDO $pdo, int $serviceId): void {
    $stmt = $pdo->prepare("SELECT image_url FROM services WHERE id = ?");
    $stmt->execute([$serviceId]);
    $oldImage = $stmt->fetchColumn();
    
    if ($oldImage && strpos($oldImage, '/uploads/') === 0) {
        $filepath = __DIR__ . '/..' . $oldImage;
        if (file_exists($filepath) && is_file($filepath)) {
            unlink($filepath);
        }
    }
}
