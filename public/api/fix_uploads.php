<?php
/**
 * Fix Uploads Permissions
 * Creates missing directories and sets correct permissions
 * Run this after deployment if uploads are not working
 */

require_once 'config.php';

// Check if running from CLI or web with admin auth
$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    // Require admin authentication for web access
    $currentUser = AuthMiddleware::requireAuth();
    if ($currentUser['role'] !== 'admin') {
        ApiResponse::forbidden('Only administrators can run this fix');
    }
}

$results = [];

// Base uploads directory
$uploadsBase = __DIR__ . '/../uploads/';

// Ensure base uploads directory exists
if (!is_dir($uploadsBase)) {
    $created = @mkdir($uploadsBase, 0775, true);
    $results['base_uploads'] = [
        'action' => 'create',
        'path' => $uploadsBase,
        'success' => $created
    ];
}

// Create subdirectories
$subdirs = ['branding', 'receipts', 'services'];
foreach ($subdirs as $subdir) {
    $path = $uploadsBase . $subdir . '/';
    
    if (!is_dir($path)) {
        $created = @mkdir($path, 0775, true);
        $results[$subdir] = [
            'action' => 'create',
            'path' => $path,
            'success' => $created
        ];
        
        if (!$created) {
            $results[$subdir]['error'] = 'Failed to create directory. Check parent directory permissions.';
        }
    } else {
        $results[$subdir] = [
            'action' => 'exists',
            'path' => $path,
            'writable' => is_writable($path)
        ];
    }
}

// Also fix rate_limits directory
$rateLimitDir = __DIR__ . '/rate_limits/';
if (!is_dir($rateLimitDir)) {
    $created = @mkdir($rateLimitDir, 0775, true);
    $results['rate_limits'] = [
        'action' => 'create',
        'path' => $rateLimitDir,
        'success' => $created
    ];
} else {
    $results['rate_limits'] = [
        'action' => 'exists',
        'path' => $rateLimitDir,
        'writable' => is_writable($rateLimitDir)
    ];
}

// Test write to each directory
foreach ($subdirs as $subdir) {
    $path = $uploadsBase . $subdir . '/';
    if (is_dir($path)) {
        $testFile = $path . '.test_' . time();
        $canWrite = @file_put_contents($testFile, 'test') !== false;
        if ($canWrite) {
            @unlink($testFile);
        }
        $results[$subdir]['write_test'] = $canWrite;
    }
}

if ($isCli) {
    echo "Fix uploads results:\n";
    print_r($results);
} else {
    ApiResponse::success([
        'message' => 'Upload directories fix attempted',
        'results' => $results,
        'php_user' => function_exists('posix_getpwuid') ? (posix_getpwuid(posix_geteuid())['name'] ?? get_current_user()) : get_current_user()
    ]);
}
