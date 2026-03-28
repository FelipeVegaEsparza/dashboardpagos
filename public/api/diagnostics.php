<?php
/**
 * Diagnostics endpoint - Check SMTP and other configurations
 * REMOVE THIS FILE AFTER DEBUGGING - It exposes sensitive info
 */

require_once 'config.php';

// Temporarily allow access without auth for debugging
// REMOVE THIS CHECK IN PRODUCTION
$allowUnauthenticated = true;
if (!$allowUnauthenticated) {
    require_once 'auth_middleware.php';
    AuthMiddleware::requireAuth();
}

$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'environment' => [
        'ENVIRONMENT' => env('ENVIRONMENT') ?: 'not set',
        'DB_HOST' => env('DB_HOST') ?: 'not set',
        'DB_NAME' => env('DB_NAME') ?: 'not set',
    ],
    'smtp_config' => [
        'SMTP_HOST' => env('SMTP_HOST') ?: 'not set',
        'SMTP_PORT' => env('SMTP_PORT') ?: 'not set',
        'SMTP_USER' => env('SMTP_USER') ? '***set***' : 'not set',
        'SMTP_PASS' => env('SMTP_PASS') ? '***set***' : 'not set',
        'SMTP_FROM_NAME' => env('SMTP_FROM_NAME') ?: 'not set',
        'SMTP_FROM_EMAIL' => env('SMTP_FROM_EMAIL') ?: 'not set',
    ],
    'imap_config' => [
        'IMAP_HOST' => env('IMAP_HOST') ?: 'not set',
        'IMAP_PORT' => env('IMAP_PORT') ?: 'not set',
        'IMAP_USER' => env('IMAP_USER') ? '***set***' : 'not set',
        'IMAP_PASS' => env('IMAP_PASS') ? '***set***' : 'not set',
    ],
    'raw_getenv' => [
        'SMTP_HOST (getenv)' => getenv('SMTP_HOST') !== false ? getenv('SMTP_HOST') : 'false',
        'SMTP_USER (getenv)' => getenv('SMTP_USER') !== false ? '***set***' : 'false',
    ],
    'raw_env' => [
        'SMTP_HOST ($_ENV)' => isset($_ENV['SMTP_HOST']) ? $_ENV['SMTP_HOST'] : 'not set',
        'SMTP_USER ($_ENV)' => isset($_ENV['SMTP_USER']) ? '***set***' : 'not set',
    ],
    'raw_server' => [
        'SMTP_HOST ($_SERVER)' => isset($_SERVER['SMTP_HOST']) ? $_SERVER['SMTP_HOST'] : 'not set',
        'SMTP_USER ($_SERVER)' => isset($_SERVER['SMTP_USER']) ? '***set***' : 'not set',
    ],
    'all_env_keys' => array_filter(array_keys(getenv()), function($k) { return stripos($k, 'smtp') !== false || stripos($k, 'mail') !== false; }),
    'extensions' => [
        'imap' => extension_loaded('imap'),
        'openssl' => extension_loaded('openssl'),
        'pdo' => extension_loaded('pdo'),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
    ],
    'phpmailer' => class_exists('PHPMailer\PHPMailer\PHPMailer'),
];

ApiResponse::success($diagnostics);
