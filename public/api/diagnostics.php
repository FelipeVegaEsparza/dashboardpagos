<?php
/**
 * Diagnostics endpoint - Check SMTP and other configurations
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
AuthMiddleware::requireAuth();

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
    'extensions' => [
        'imap' => extension_loaded('imap'),
        'openssl' => extension_loaded('openssl'),
        'pdo' => extension_loaded('pdo'),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
    ],
    'phpmailer' => class_exists('PHPMailer\PHPMailer\PHPMailer'),
];

ApiResponse::success($diagnostics);
