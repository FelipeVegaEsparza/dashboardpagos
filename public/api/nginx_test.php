<?php
/**
 * Test endpoint to verify requests are reaching the API
 */
header('Content-Type: application/json');
echo json_encode([
    'status' => 'API is reachable',
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
    'time' => date('Y-m-d H:i:s')
]);
