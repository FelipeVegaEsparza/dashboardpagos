<?php
/**
 * File Server - Sirve archivos desde uploads
 * Uso: /api/file.php?path=branding/logo.png
 */

$uploadsDir = __DIR__ . '/../uploads/';

// Sanitizar path
$path = $_GET['path'] ?? '';
$path = str_replace('..', '', $path); // Prevenir directory traversal
$path = ltrim($path, '/');

if (empty($path)) {
    http_response_code(400);
    echo 'No file specified';
    exit;
}

$fullPath = $uploadsDir . $path;

// Verificar que el archivo existe
if (!file_exists($fullPath) || !is_file($fullPath)) {
    http_response_code(404);
    echo 'File not found: ' . htmlspecialchars($path);
    exit;
}

// Verificar que está dentro de uploads
$realUploadsDir = realpath($uploadsDir);
$realFilePath = realpath($fullPath);

if (strpos($realFilePath, $realUploadsDir) !== 0) {
    http_response_code(403);
    echo 'Access denied';
    exit;
}

// Determinar MIME type
$mimeTypes = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'ico' => 'image/x-icon',
    'pdf' => 'application/pdf',
];

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$contentType = $mimeTypes[$ext] ?? mime_content_type($fullPath) ?? 'application/octet-stream';

// Servir archivo
header('Content-Type: ' . $contentType);
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: public, max-age=86400');

readfile($fullPath);
