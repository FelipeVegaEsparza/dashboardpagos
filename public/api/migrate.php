<?php
/**
 * Migration endpoint - Run database migrations
 * REMOVE THIS FILE AFTER USE
 */

require_once 'config.php';

// Allow unauthenticated access for now (REMOVE IN PRODUCTION)
header('Content-Type: application/json');

try {
    // Add last_email_sent column to subscriptions if not exists
    $pdo->exec("
        ALTER TABLE subscriptions 
        ADD COLUMN IF NOT EXISTS last_email_sent TIMESTAMP NULL
    ");
    
    echo json_encode(['success' => true, 'message' => 'Migration completed']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
