<?php
/**
 * Payments API Endpoint - Protected with Authentication
 * Optimized with transaction safety and race condition prevention
 */

try {
    require_once 'config.php';
    require_once 'auth_middleware.php';
} catch (Exception $e) {
    error_log('Failed to load required files in payments.php: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server initialization failed', 'details' => $e->getMessage()]);
    exit;
}

// Require authentication
try {
    AuthMiddleware::requireAuth();
} catch (Exception $e) {
    error_log('Auth error in payments.php: ' . $e->getMessage());
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;

    case 'POST':
        handlePost($pdo);
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - Get payment history
 */
function handleGet(PDO $pdo): void {
    try {
        $subscriptionId = InputValidator::int($_GET['subscription_id'] ?? null);
        
        if (!$subscriptionId) {
            ApiResponse::error('Subscription ID is required', 400);
            return;
        }
        
        // Verify database connection
        if (!isset($pdo) || !$pdo) {
            error_log('Database connection not available in payments.php handleGet');
            ApiResponse::serverError('Database connection failed');
            return;
        }
        
        $stmt = $pdo->prepare("
            SELECT 
                p.id, p.subscription_id, p.date, p.amount, p.status, 
                p.receipt_url, p.created_at
            FROM payments p
            WHERE p.subscription_id = ?
            ORDER BY p.date DESC, p.id DESC
        ");
        $stmt->execute([$subscriptionId]);
        $payments = $stmt->fetchAll();
        
        ApiResponse::success(['items' => $payments]);
        
    } catch (PDOException $e) {
        error_log('PDO Error fetching payments: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch payments');
    } catch (Exception $e) {
        error_log('Unexpected error in payments.php handleGet: ' . $e->getMessage());
        ApiResponse::serverError('An unexpected error occurred');
    }
}

/**
 * Handle POST request - Register payment with transaction safety
 */
function handlePost(PDO $pdo): void {
    // Handle file upload first
    $receiptUrl = null;
    
    if (isset($_FILES['receipt']) && $_FILES['receipt']['error'] !== UPLOAD_ERR_NO_FILE) {
        $receiptUrl = handleReceiptUpload($_FILES['receipt']);
        if ($receiptUrl === false) {
            return; // Error already sent
        }
    }
    
    // Handle form data
    $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('subscription_id', 'Subscription ID is required')
        ->numeric('subscription_id', 1, null, 'Invalid subscription ID')
        ->required('amount', 'Amount is required')
        ->numeric('amount', 0.01, 999999999.99, 'Invalid amount')
        ->required('date', 'Payment date is required')
        ->date('date', 'Y-m-d', 'Invalid date format');
    
    $validator->throwIfFailed();
    
    $subscriptionId = (int) $data['subscription_id'];
    $amount = (float) $data['amount'];
    $date = $data['date'];
    
    try {
        $pdo->beginTransaction();
        
        // Lock subscription row to prevent race conditions
        $stmt = $pdo->prepare("
            SELECT s.id, s.next_payment_date, p.billing_cycle, p.price
            FROM subscriptions s
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
            FOR UPDATE
        ");
        $stmt->execute([$subscriptionId]);
        $subscription = $stmt->fetch();
        
        if (!$subscription) {
            $pdo->rollBack();
            ApiResponse::notFound('Subscription');
            return;
        }
        
        // Validate amount matches expected (optional but recommended)
        $expectedAmount = (float) $subscription['price'];
        $tolerance = 0.01; // Allow small rounding differences
        if (abs($amount - $expectedAmount) > $tolerance) {
            // Log warning but still allow (for partial payments or price changes)
            error_log("Payment amount ($amount) differs from expected ($expectedAmount) for subscription $subscriptionId");
        }
        
        // Insert payment record
        $stmt = $pdo->prepare("
            INSERT INTO payments 
            (subscription_id, date, amount, status, receipt_url) 
            VALUES (?, ?, ?, 'paid', ?)
        ");
        $stmt->execute([$subscriptionId, $date, $amount, $receiptUrl]);
        
        $paymentId = $pdo->lastInsertId();
        
        // Calculate new next payment date
        $currentNextDate = new DateTime($subscription['next_payment_date']);
        
        if ($subscription['billing_cycle'] === 'monthly') {
            $currentNextDate->modify('+1 month');
        } else {
            $currentNextDate->modify('+1 year');
        }
        
        $newNextDate = $currentNextDate->format('Y-m-d');
        
        // Update subscription
        $stmt = $pdo->prepare("
            UPDATE subscriptions 
            SET next_payment_date = ?, status = 'active'
            WHERE id = ?
        ");
        $stmt->execute([$newNextDate, $subscriptionId]);
        
        $pdo->commit();
        
        ApiResponse::success([
            'id' => $paymentId,
            'subscription_id' => $subscriptionId,
            'amount' => $amount,
            'date' => $date,
            'new_next_payment_date' => $newNextDate,
            'message' => 'Payment registered successfully'
        ], 201);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Error registering payment: ' . $e->getMessage());
        ApiResponse::serverError('Failed to register payment');
    }
}

/**
 * Handle receipt file upload with security validation
 */
function handleReceiptUpload(array $file): string|false {
    // Check upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = match ($file['error']) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds server limit (upload_max_filesize)',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form limit',
            UPLOAD_ERR_PARTIAL => 'File partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file',
            UPLOAD_ERR_EXTENSION => 'Upload stopped by extension',
            default => 'Unknown upload error'
        };
        ApiResponse::error($errorMsg, 400);
        return false;
    }
    
    // Validate file size (max 5MB for receipts)
    $maxSize = 5 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        ApiResponse::error('File too large. Maximum size is 5MB', 400);
        return false;
    }
    
    // Validate MIME type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    
    $allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ];
    
    if (!in_array($mimeType, $allowedMimes)) {
        ApiResponse::error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDF allowed', 400);
        return false;
    }
    
    // Determine extension
    $extension = match ($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
        default => null
    };
    
    if (!$extension) {
        ApiResponse::error('Unsupported file format', 400);
        return false;
    }
    
    // Create upload directory with secure permissions
    $uploadDir = __DIR__ . '/../uploads/receipts/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            error_log('Failed to create receipts directory: ' . $uploadDir);
            ApiResponse::serverError('Upload directory creation failed');
            return false;
        }
    }
    
    // Prevent script execution in upload directory
    $htaccess = $uploadDir . '.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Options -ExecCGI\nAddHandler cgi-script .php .pl .jsp .asp .sh .cgi\n<FilesMatch \"\\.(php|pl|jsp|asp|sh|cgi)$\">\nOrder allow,deny\nDeny from all\n</FilesMatch>");
    }
    
    // Generate secure filename
    $filename = bin2hex(random_bytes(16)) . '_' . time() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        error_log('Failed to move receipt file to: ' . $filepath);
        ApiResponse::serverError('File upload failed');
        return false;
    }
    
    // Set secure permissions
    chmod($filepath, 0644);
    
    return '/uploads/receipts/' . $filename;
}
