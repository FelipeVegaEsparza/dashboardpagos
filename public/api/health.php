<?php
/**
 * Health Check Endpoint
 * Returns diagnostic information about the API status
 */

// Don't require auth for health check
header('Content-Type: application/json; charset=utf-8');

$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'status' => 'ok',
    'checks' => []
];

// Check PHP version
$diagnostics['checks']['php_version'] = [
    'status' => 'ok',
    'version' => PHP_VERSION
];

// Check if required extensions are loaded
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
$missingExtensions = [];
foreach ($requiredExtensions as $ext) {
    if (!extension_loaded($ext)) {
        $missingExtensions[] = $ext;
    }
}
if (empty($missingExtensions)) {
    $diagnostics['checks']['extensions'] = ['status' => 'ok'];
} else {
    $diagnostics['checks']['extensions'] = [
        'status' => 'error',
        'missing' => $missingExtensions
    ];
    $diagnostics['status'] = 'error';
}

// Check environment variables
$envVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
$missingVars = [];
foreach ($envVars as $var) {
    $value = getenv($var);
    if (!$value) {
        $missingVars[] = $var;
    }
}
if (empty($missingVars)) {
    $diagnostics['checks']['environment'] = ['status' => 'ok'];
} else {
    $diagnostics['checks']['environment'] = [
        'status' => 'warning',
        'missing' => $missingVars
    ];
}

// Try to connect to database
try {
    require_once 'config.php';
    $diagnostics['checks']['database'] = ['status' => 'ok'];
} catch (Exception $e) {
    $diagnostics['checks']['database'] = [
        'status' => 'error',
        'error' => $e->getMessage()
    ];
    $diagnostics['status'] = 'error';
}

// Check write permissions for uploads
$uploadDirs = [
    __DIR__ . '/../uploads',
    __DIR__ . '/../uploads/receipts',
    __DIR__ . '/../uploads/branding'
];
$permissionIssues = [];
foreach ($uploadDirs as $dir) {
    if (!is_dir($dir)) {
        $permissionIssues[] = ['path' => $dir, 'issue' => 'does not exist'];
    } elseif (!is_writable($dir)) {
        $permissionIssues[] = ['path' => $dir, 'issue' => 'not writable'];
    }
}
if (empty($permissionIssues)) {
    $diagnostics['checks']['uploads'] = ['status' => 'ok'];
} else {
    $diagnostics['checks']['uploads'] = [
        'status' => 'warning',
        'issues' => $permissionIssues
    ];
}

// Check error log
$errorLog = __DIR__ . '/error.log';
if (file_exists($errorLog)) {
    $size = filesize($errorLog);
    $diagnostics['checks']['error_log'] = [
        'status' => 'ok',
        'path' => $errorLog,
        'size_bytes' => $size
    ];
    
    // Get last errors if log is not too large
    if ($size > 0 && $size < 1024 * 1024) { // Less than 1MB
        $content = file_get_contents($errorLog);
        $lines = array_filter(explode("\n", $content));
        $lastErrors = array_slice($lines, -10); // Last 10 errors
        if (!empty($lastErrors)) {
            $diagnostics['checks']['error_log']['recent_errors'] = $lastErrors;
        }
    }
} else {
    $diagnostics['checks']['error_log'] = [
        'status' => 'warning',
        'message' => 'Error log file not found'
    ];
}

http_response_code($diagnostics['status'] === 'ok' ? 200 : 500);
echo json_encode($diagnostics, JSON_PRETTY_PRINT);
