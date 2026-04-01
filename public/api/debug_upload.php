<?php
/**
 * Debug Upload - Verifica dónde están los archivos
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

$uploadsDir = __DIR__ . '/../uploads/';
$brandingDir = $uploadsDir . 'branding/';

$result = [
    'server' => [
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A',
        'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'N/A',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
    ],
    'paths' => [
        'uploads_dir' => $uploadsDir,
        'branding_dir' => $brandingDir,
    ],
    'exists' => [
        'uploads_dir' => is_dir($uploadsDir),
        'branding_dir' => is_dir($brandingDir),
    ],
    'writable' => [
        'uploads_dir' => is_writable($uploadsDir),
        'branding_dir' => is_writable($brandingDir),
    ],
    'files' => []
];

// Listar archivos en branding
if (is_dir($brandingDir)) {
    $files = glob($brandingDir . '*');
    foreach ($files as $file) {
        if (is_file($file)) {
            $result['files'][] = [
                'name' => basename($file),
                'full_path' => $file,
                'size' => filesize($file),
                'url' => '/uploads/branding/' . basename($file),
                'readable' => is_readable($file)
            ];
        }
    }
}

// Verificar si podemos crear un archivo de prueba
$testFile = $brandingDir . 'test_' . time() . '.txt';
$testContent = 'Test file created at ' . date('Y-m-d H:i:s');
$created = @file_put_contents($testFile, $testContent);

$result['test_write'] = [
    'file' => $testFile,
    'success' => $created !== false,
    'content_written' => $testContent,
    'content_read' => $created ? @file_get_contents($testFile) : null
];

if ($created) {
    @unlink($testFile);
}

echo json_encode($result, JSON_PRETTY_PRINT);
