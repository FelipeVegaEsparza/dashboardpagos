<?php
/**
 * Clients API Endpoint - Protected with Authentication
 * Optimized with validation and pagination
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication for all operations
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
 * Handle GET request - List clients with pagination and search
 */
function handleGet(PDO $pdo): void {
    $pagination = Pagination::getParams(20, 100);
    $search = $_GET['search'] ?? '';
    
    try {
        // Build query
        $where = '';
        $params = [];
        
        if ($search) {
            $where = "WHERE name LIKE :search OR email LIKE :search";
            $params[':search'] = '%' . $search . '%';
        }
        
        // Get total count
        $countSql = "SELECT COUNT(*) FROM clients $where";
        $stmt = $pdo->prepare($countSql);
        $stmt->execute($params);
        $total = $stmt->fetchColumn();
        
        // Get paginated results
        $sql = "SELECT id, name, email, phone, created_at 
                FROM clients 
                $where 
                ORDER BY created_at DESC 
                LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        
        if ($search) {
            $stmt->bindValue(':search', '%' . $search . '%');
        }
        $stmt->bindValue(':limit', $pagination['limit'], PDO::PARAM_INT);
        $stmt->bindValue(':offset', $pagination['offset'], PDO::PARAM_INT);
        $stmt->execute();
        
        $clients = $stmt->fetchAll();
        
        ApiResponse::success([
            'items' => $clients,
            'pagination' => Pagination::meta($pagination['page'], $pagination['limit'], $total)
        ]);
        
    } catch (PDOException $e) {
        error_log('Error fetching clients: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch clients');
    }
}

/**
 * Handle POST request - Create new client
 */
function handlePost(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('name', 'Client name is required')
        ->length('name', 2, 255, 'Name must be between 2 and 255 characters')
        ->email('email', 'Invalid email format')
        ->length('phone', 0, 50, 'Phone number too long');
    
    $validator->throwIfFailed();
    
    // Sanitize inputs
    $name = InputValidator::sanitize($data['name']);
    $email = $data['email'] ? strtolower(trim($data['email'])) : null;
    $phone = $data['phone'] ? InputValidator::sanitize($data['phone']) : null;
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO clients (name, email, phone, created_at) 
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$name, $email, $phone]);
        
        $id = $pdo->lastInsertId();
        
        ApiResponse::success([
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'message' => 'Client created successfully'
        ], 201);
        
    } catch (PDOException $e) {
        error_log('Error creating client: ' . $e->getMessage());
        ApiResponse::serverError('Failed to create client');
    }
}

/**
 * Handle PUT request - Update existing client
 */
function handlePut(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('id', 'Client ID is required')
        ->numeric('id', 1, null, 'Invalid client ID')
        ->required('name', 'Client name is required')
        ->length('name', 2, 255)
        ->email('email')
        ->length('phone', 0, 50);
    
    $validator->throwIfFailed();
    
    $id = (int) $data['id'];
    $name = InputValidator::sanitize($data['name']);
    $email = $data['email'] ? strtolower(trim($data['email'])) : null;
    $phone = $data['phone'] ? InputValidator::sanitize($data['phone']) : null;
    
    try {
        // Check if client exists
        $stmt = $pdo->prepare("SELECT id FROM clients WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            ApiResponse::notFound('Client');
            return;
        }
        
        $stmt = $pdo->prepare("
            UPDATE clients 
            SET name = ?, email = ?, phone = ? 
            WHERE id = ?
        ");
        $stmt->execute([$name, $email, $phone, $id]);
        
        ApiResponse::success([
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'message' => 'Client updated successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Error updating client: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update client');
    }
}

/**
 * Handle DELETE request - Delete client
 */
function handleDelete(PDO $pdo): void {
    $id = InputValidator::int($_GET['id'] ?? null);
    
    if (!$id) {
        ApiResponse::error('Client ID is required', 400);
        return;
    }
    
    try {
        // Check if client has active subscriptions
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM subscriptions WHERE client_id = ?");
        $stmt->execute([$id]);
        $subscriptionCount = $stmt->fetchColumn();
        
        if ($subscriptionCount > 0) {
            ApiResponse::error(
                'Cannot delete client with active subscriptions. Please delete subscriptions first.', 
                409
            );
            return;
        }
        
        $stmt = $pdo->prepare("DELETE FROM clients WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            ApiResponse::notFound('Client');
            return;
        }
        
        ApiResponse::success(['message' => 'Client deleted successfully']);
        
    } catch (PDOException $e) {
        error_log('Error deleting client: ' . $e->getMessage());
        ApiResponse::serverError('Failed to delete client');
    }
}
