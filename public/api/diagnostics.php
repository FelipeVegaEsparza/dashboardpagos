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
        'ENVIRONMENT' => getenv('ENVIRONMENT') ?: 'not set',
        'DB_HOST' => getenv('DB_HOST') ?: 'not set',
        'DB_NAME' => getenv('DB_NAME') ?: 'not set',
    ],
    'smtp_config' => [
        'SMTP_HOST' => getenv('SMTP_HOST') ?: 'not set',
        'SMTP_PORT' => getenv('SMTP_PORT') ?: 'not set',
        'SMTP_USER' => getenv('SMTP_USER') ? '***set***' : 'not set',
        'SMTP_PASS' => getenv('SMTP_PASS') ? '***set***' : 'not set',
        'SMTP_FROM_NAME' => getenv('SMTP_FROM_NAME') ?: 'not set',
        'SMTP_FROM_EMAIL' => getenv('SMTP_FROM_EMAIL') ?: 'not set',
    ],
    'imap_config' => [
        'IMAP_HOST' => getenv('IMAP_HOST') ?: 'not set',
        'IMAP_PORT' => getenv('IMAP_PORT') ?: 'not set',
        'IMAP_USER' => getenv('IMAP_USER') ? '***set***' : 'not set',
        'IMAP_PASS' => getenv('IMAP_PASS') ? '***set***' : 'not set',
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
