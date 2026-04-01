<?php
/**
 * Uploads Directory Check and Fix
 * Diagnoses and attempts to fix upload directory issues
 */

require_once 'config.php';

// Require admin authentication
$currentUser = AuthMiddleware::requireAuth();
if ($currentUser['role'] !== 'admin') {
    ApiResponse::forbidden('Only administrators can run diagnostics');
}

$uploadsBase = __DIR__ . '/../uploads/';
$directories = [
    'branding' => $uploadsBase . 'branding/',
    'receipts' => $uploadsBase . 'receipts/',
    'services' => $uploadsBase . 'services/',
];

$results = [];
$allOk = true;

foreach ($directories as $name => $path) {
    $result = [
        'path' => $path,
        'exists' => false,
        'writable' => false,
        'permissions' => null,
        'owner' => null,
        'files_count' => 0
    ];
    
    // Check if exists
    $result['exists'] = is_dir($path);
    
    if ($result['exists']) {
        // Check writable
        $result['writable'] = is_writable($path);
        
        // Get permissions
        $perms = fileperms($path);
        $result['permissions'] = substr(sprintf('%o', $perms), -4);
        
        // Get owner
        if (function_exists('posix_getpwuid')) {
            $owner = posix_getpwuid(fileowner($path));
            $result['owner'] = $owner['name'] ?? fileowner($path);
        } else {
            $result['owner'] = fileowner($path);
        }
        
        // Count files
        $files = glob($path . '*');
        $result['files_count'] = count($files);
        $result['files'] = array_slice($files, 0, 10); // First 10 files
    } else {
        $allOk = false;
        // Try to create
        $created = @mkdir($path, 0775, true);
        $result['created'] = $created;
        if ($created) {
            $result['exists'] = true;
            $result['writable'] = is_writable($path);
        }
    }
    
    if (!$result['writable']) {
        $allOk = false;
    }
    
    $results[$name] = $result;
}

// Test write by creating a test file
$testFile = $uploadsBase . 'branding/.test_write_' . time();
$canWrite = @file_put_contents($testFile, 'test') !== false;
if ($canWrite) {
    @unlink($testFile);
}

ApiResponse::success([
    'all_ok' => $allOk,
    'php_user' => function_exists('posix_getpwuid') ? (posix_getpwuid(posix_geteuid())['name'] ?? get_current_user()) : get_current_user(),
    'can_write_test' => $canWrite,
    'directories' => $results
]);
