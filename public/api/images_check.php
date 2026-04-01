<?php
/**
 * Images Integrity Check
 * Verifies that images referenced in database exist on filesystem
 */

require_once 'config.php';

// Require admin authentication
$currentUser = AuthMiddleware::requireAuth();
if ($currentUser['role'] !== 'admin') {
    ApiResponse::forbidden('Only administrators can run diagnostics');
}

try {
    $issues = [];
    $ok = [];
    
    // Check branding images (logo, favicon)
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_type = 'image' AND setting_value IS NOT NULL");
    $brandingImages = $stmt->fetchAll();
    
    foreach ($brandingImages as $image) {
        $path = __DIR__ . '/..' . $image['setting_value'];
        $exists = file_exists($path);
        $info = [
            'key' => $image['setting_key'],
            'url' => $image['setting_value'],
            'full_path' => $path,
            'exists' => $exists
        ];
        
        if ($exists) {
            $info['size'] = filesize($path);
            $ok[] = $info;
        } else {
            $issues[] = $info;
        }
    }
    
    // Check service images
    $stmt = $pdo->query("SELECT id, name, image_url FROM services WHERE image_url IS NOT NULL");
    $serviceImages = $stmt->fetchAll();
    
    foreach ($serviceImages as $image) {
        $path = __DIR__ . '/..' . $image['image_url'];
        $exists = file_exists($path);
        $info = [
            'type' => 'service',
            'id' => $image['id'],
            'name' => $image['name'],
            'url' => $image['image_url'],
            'full_path' => $path,
            'exists' => $exists
        ];
        
        if ($exists) {
            $info['size'] = filesize($path);
            $ok[] = $info;
        } else {
            $issues[] = $info;
        }
    }
    
    // Check receipt files
    $stmt = $pdo->query("SELECT id, subscription_id, receipt_url FROM payments WHERE receipt_url IS NOT NULL");
    $receipts = $stmt->fetchAll();
    
    foreach ($receipts as $receipt) {
        $path = __DIR__ . '/..' . $receipt['receipt_url'];
        $exists = file_exists($path);
        $info = [
            'type' => 'receipt',
            'id' => $receipt['id'],
            'subscription_id' => $receipt['subscription_id'],
            'url' => $receipt['receipt_url'],
            'full_path' => $path,
            'exists' => $exists
        ];
        
        if ($exists) {
            $info['size'] = filesize($path);
            $ok[] = $info;
        } else {
            $issues[] = $info;
        }
    }
    
    // List all files in uploads directories
    $uploadsDir = __DIR__ . '/../uploads/';
    $allFiles = [];
    foreach (glob($uploadsDir . '*/*') as $file) {
        $allFiles[] = [
            'path' => $file,
            'relative' => str_replace(__DIR__ . '/..', '', $file),
            'size' => filesize($file),
            'modified' => date('Y-m-d H:i:s', filemtime($file))
        ];
    }
    
    ApiResponse::success([
        'summary' => [
            'total_checked' => count($ok) + count($issues),
            'ok' => count($ok),
            'missing' => count($issues),
            'total_files_on_disk' => count($allFiles)
        ],
        'missing_files' => $issues,
        'ok_files' => array_slice($ok, 0, 20), // Limit to first 20
        'all_files_on_disk' => array_slice($allFiles, 0, 50) // Limit to first 50
    ]);
    
} catch (PDOException $e) {
    error_log('Image check error: ' . $e->getMessage());
    ApiResponse::serverError('Failed to check images: ' . $e->getMessage());
}
