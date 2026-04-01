<?php
/**
 * Database Migration Script
 * Run this to fix the payments table schema
 */

require_once 'config.php';

// Only allow admin users or local execution
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST required']);
    exit;
}

try {
    // Check for a simple migration key for security
    $data = json_decode(file_get_contents('php://input'), true);
    $migrationKey = $data['migration_key'] ?? '';
    
    // Simple protection - should be enhanced for production
    $expectedKey = getenv('MIGRATION_KEY') ?: 'default_insecure_key_change_me';
    
    if ($migrationKey !== $expectedKey) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid migration key']);
        exit;
    }
    
    $results = [];
    
    // Check if receipt_url column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM payments LIKE 'receipt_url'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN receipt_url VARCHAR(500) NULL");
        $results[] = 'Added receipt_url column to payments table';
    } else {
        $results[] = 'receipt_url column already exists';
    }
    
    // Check if created_at column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM payments LIKE 'created_at'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        $results[] = 'Added created_at column to payments table';
    } else {
        $results[] = 'created_at column already exists';
    }
    
    // Check if index exists
    $stmt = $pdo->query("SHOW INDEX FROM payments WHERE Key_name = 'idx_subscription_id'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE payments ADD INDEX idx_subscription_id (subscription_id)");
        $results[] = 'Added idx_subscription_id index';
    } else {
        $results[] = 'idx_subscription_id index already exists';
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully',
        'results' => $results
    ]);
    
} catch (PDOException $e) {
    error_log('Migration error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Migration failed: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log('Unexpected migration error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unexpected error: ' . $e->getMessage()
    ]);
}
