<?php
/**
 * Settings API Endpoint
 * Handles application configuration and branding
 * GET is public, POST requires admin authentication
 */

require_once 'config.php';
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Public endpoint - no authentication required for reading settings
        handleGet($pdo);
        break;

    case 'POST':
        // Only admins can update settings
        $currentUser = AuthMiddleware::requireAuth();
        if ($currentUser['role'] !== 'admin') {
            ApiResponse::forbidden('Only administrators can modify settings');
        }
        handlePost($pdo, $currentUser['id']);
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - Get all settings or specific setting
 */
function handleGet(PDO $pdo): void {
    try {
        $key = $_GET['key'] ?? null;
        
        if ($key) {
            // Get specific setting
            $stmt = $pdo->prepare("SELECT * FROM settings WHERE setting_key = ?");
            $stmt->execute([$key]);
            $setting = $stmt->fetch();
            
            if (!$setting) {
                ApiResponse::notFound('Setting');
                return;
            }
            
            ApiResponse::success(['item' => $setting]);
        } else {
            // Get all settings
            $stmt = $pdo->query("SELECT * FROM settings ORDER BY setting_key");
            $settings = $stmt->fetchAll();
            
            // Convert to key-value format for easier consumption
            $settingsMap = [];
            foreach ($settings as $setting) {
                $settingsMap[$setting['setting_key']] = [
                    'value' => $setting['setting_value'],
                    'type' => $setting['setting_type'],
                    'updated_at' => $setting['updated_at']
                ];
            }
            
            ApiResponse::success([
                'items' => $settings,
                'map' => $settingsMap
            ]);
        }
        
    } catch (PDOException $e) {
        error_log('Error fetching settings: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch settings');
    }
}

/**
 * Handle POST request - Update settings with file upload support
 */
function handlePost(PDO $pdo, int $userId): void {
    ini_set('display_errors', 0);
    
    // Handle file uploads first
    $uploadedFiles = [];
    
    // Handle logo upload
    if (isset($_FILES['app_logo']) && $_FILES['app_logo']['error'] !== UPLOAD_ERR_NO_FILE) {
        $logoUrl = handleImageUpload($_FILES['app_logo'], 'logo');
        if ($logoUrl === false) {
            return; // Error already sent
        }
        $uploadedFiles['app_logo'] = $logoUrl;
    }
    
    // Handle favicon upload
    if (isset($_FILES['app_favicon']) && $_FILES['app_favicon']['error'] !== UPLOAD_ERR_NO_FILE) {
        $faviconUrl = handleImageUpload($_FILES['app_favicon'], 'favicon');
        if ($faviconUrl === false) {
            return; // Error already sent
        }
        $uploadedFiles['app_favicon'] = $faviconUrl;
    }
    
    // Handle form/text data
    $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }
    
    try {
        $pdo->beginTransaction();
        $updatedSettings = [];
        
        // Update text settings
        $textSettings = [
            'app_name' => ['required' => true, 'max_length' => 100],
            'app_description' => ['required' => false, 'max_length' => 500]
        ];
        
        foreach ($textSettings as $key => $config) {
            if (isset($data[$key])) {
                $value = InputValidator::sanitize($data[$key]);
                
                if ($config['required'] && empty($value)) {
                    $pdo->rollBack();
                    ApiResponse::error("Setting '$key' is required", 400);
                    return;
                }
                
                if (strlen($value) > $config['max_length']) {
                    $pdo->rollBack();
                    ApiResponse::error("Setting '$key' exceeds maximum length of {$config['max_length']}", 400);
                    return;
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO settings (setting_key, setting_value, setting_type, updated_by)
                    VALUES (?, ?, 'string', ?)
                    ON DUPLICATE KEY UPDATE 
                        setting_value = VALUES(setting_value),
                        updated_by = VALUES(updated_by),
                        updated_at = CURRENT_TIMESTAMP
                ");
                $stmt->execute([$key, $value, $userId]);
                $updatedSettings[$key] = $value;
            }
        }
        
        // Update file settings (logo/favicon)
        foreach ($uploadedFiles as $key => $url) {
            $stmt = $pdo->prepare("
                INSERT INTO settings (setting_key, setting_value, setting_type, updated_by)
                VALUES (?, ?, 'image', ?)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    updated_by = VALUES(updated_by),
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$key, $url, $userId]);
            $updatedSettings[$key] = $url;
        }
        
        $pdo->commit();
        
        ApiResponse::success([
            'message' => 'Settings updated successfully',
            'updated' => $updatedSettings
        ]);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Error updating settings: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update settings');
    }
}

/**
 * Handle image upload for logo/favicon
 */
function handleImageUpload(array $file, string $type): string|false {
    // Check upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = match ($file['error']) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds server limit',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form limit',
            UPLOAD_ERR_PARTIAL => 'File partially uploaded',
            default => 'Upload error'
        };
        ApiResponse::error($errorMsg, 400);
        return false;
    }
    
    // Size limits
    $maxSize = ($type === 'favicon') ? 1 * 1024 * 1024 : 2 * 1024 * 1024; // 1MB favicon, 2MB logo
    if ($file['size'] > $maxSize) {
        ApiResponse::error('File too large', 400);
        return false;
    }
    
    // Validate MIME type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    
    if (!in_array($mimeType, $allowedMimes)) {
        ApiResponse::error('Invalid file type. Only images allowed', 400);
        return false;
    }
    
    // Determine extension
    $extension = match ($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/x-icon', 'image/vnd.microsoft.icon' => 'ico',
        default => 'png'
    };
    
    // Create upload directory
    $uploadDir = __DIR__ . '/../uploads/branding/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            ApiResponse::serverError('Failed to create upload directory');
            return false;
        }
    }
    
    // Generate filename
    $filename = $type . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        ApiResponse::serverError('Failed to save file');
        return false;
    }
    
    chmod($filepath, 0644);
    
    return '/uploads/branding/' . $filename;
}
