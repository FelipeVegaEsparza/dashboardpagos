<?php
/**
 * Subscriptions API Endpoint - Protected with Authentication
 * Optimized with transaction safety and date calculations
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
AuthMiddleware::requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;

    case 'POST':
        handlePost($pdo);
        break;

    case 'PUT':
        handlePut($pdo);
        break;

    case 'DELETE':
        handleDelete($pdo);
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - List subscriptions with filters
 */
function handleGet(PDO $pdo): void {
    $clientId = InputValidator::int($_GET['client_id'] ?? null);
    $status = $_GET['status'] ?? null;
    $page = InputValidator::int($_GET['page'] ?? 1, 1);
    $limit = min(InputValidator::int($_GET['limit'] ?? 20, 20), 100);
    $offset = ($page - 1) * $limit;
    
    try {
        $where = [];
        $params = [];
        
        if ($clientId) {
            $where[] = "s.client_id = :client_id";
            $params[':client_id'] = $clientId;
        }
        
        if ($status && in_array($status, ['active', 'cancelled', 'paused'])) {
            $where[] = "s.status = :status";
            $params[':status'] = $status;
        }
        
        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        
        // Get total count
        $countSql = "SELECT COUNT(*) FROM subscriptions s $whereClause";
        $stmt = $pdo->prepare($countSql);
        $stmt->execute($params);
        $total = $stmt->fetchColumn();
        
        // Get paginated results
        $sql = "
            SELECT 
                s.id, s.client_id, s.product_id, s.start_date, 
                s.next_payment_date, s.status,
                c.name as client_name,
                p.name as product_name, p.price, p.billing_cycle,
                serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
            $whereClause
            ORDER BY s.next_payment_date ASC, c.name ASC
            LIMIT :limit OFFSET :offset
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $subscriptions = $stmt->fetchAll();
        
        ApiResponse::success([
            'items' => $subscriptions,
            'pagination' => Pagination::meta($page, $limit, $total)
        ]);
        
    } catch (PDOException $e) {
        error_log('Error fetching subscriptions: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch subscriptions');
    }
}

/**
 * Handle POST request - Create subscription with date calculation
 */
function handlePost(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('client_id', 'Client is required')
        ->numeric('client_id', 1, null, 'Invalid client ID')
        ->required('product_id', 'Product is required')
        ->numeric('product_id', 1, null, 'Invalid product ID')
        ->required('start_date', 'Start date is required')
        ->date('start_date', 'Y-m-d', 'Invalid date format (YYYY-MM-DD)');
    
    $validator->throwIfFailed();
    
    $clientId = (int) $data['client_id'];
    $productId = (int) $data['product_id'];
    $startDate = $data['start_date'];
    
    try {
        $pdo->beginTransaction();
        
        // Verify client exists
        $stmt = $pdo->prepare("SELECT id FROM clients WHERE id = ?");
        $stmt->execute([$clientId]);
        if (!$stmt->fetch()) {
            $pdo->rollBack();
            ApiResponse::error('Client not found', 404);
            return;
        }
        
        // Get product details and lock row for consistency
        $stmt = $pdo->prepare("SELECT billing_cycle, price FROM products WHERE id = ? FOR UPDATE");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        
        if (!$product) {
            $pdo->rollBack();
            ApiResponse::error('Product not found', 404);
            return;
        }
        
        // Calculate next payment date
        $nextPaymentDate = calculateNextPaymentDate($startDate, $product['billing_cycle']);
        
        // Check for duplicate active subscription
        $stmt = $pdo->prepare("
            SELECT id FROM subscriptions 
            WHERE client_id = ? AND product_id = ? AND status = 'active'
        ");
        $stmt->execute([$clientId, $productId]);
        if ($stmt->fetch()) {
            $pdo->rollBack();
            ApiResponse::error('Client already has an active subscription for this product', 409);
            return;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO subscriptions 
            (client_id, product_id, start_date, next_payment_date, status) 
            VALUES (?, ?, ?, ?, 'active')
        ");
        $stmt->execute([$clientId, $productId, $startDate, $nextPaymentDate]);
        
        $id = $pdo->lastInsertId();
        
        $pdo->commit();
        
        ApiResponse::success([
            'id' => $id,
            'client_id' => $clientId,
            'product_id' => $productId,
            'start_date' => $startDate,
            'next_payment_date' => $nextPaymentDate,
            'price' => $product['price'],
            'billing_cycle' => $product['billing_cycle'],
            'message' => 'Subscription created successfully'
        ], 201);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Error creating subscription: ' . $e->getMessage());
        ApiResponse::serverError('Failed to create subscription');
    }
}

/**
 * Handle PUT request - Update subscription
 */
function handlePut(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $validator = new InputValidator($data);
    $validator
        ->required('id', 'Subscription ID is required')
        ->numeric('id', 1, null, 'Invalid subscription ID')
        ->in('status', ['active', 'cancelled', 'paused'], 'Invalid status');
    
    if (!empty($data['next_payment_date'])) {
        $validator->date('next_payment_date', 'Y-m-d');
    }
    
    $validator->throwIfFailed();
    
    $id = (int) $data['id'];
    $status = $data['status'];
    $nextPaymentDate = $data['next_payment_date'] ?? null;
    
    try {
        // Check existence
        $stmt = $pdo->prepare("SELECT id FROM subscriptions WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            ApiResponse::notFound('Subscription');
            return;
        }
        
        $sql = "UPDATE subscriptions SET status = ?";
        $params = [$status];
        
        if ($nextPaymentDate) {
            $sql .= ", next_payment_date = ?";
            $params[] = $nextPaymentDate;
        }
        
        $sql .= " WHERE id = ?";
        $params[] = $id;
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        ApiResponse::success([
            'id' => $id,
            'status' => $status,
            'message' => 'Subscription updated successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Error updating subscription: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update subscription');
    }
}

/**
 * Handle DELETE request - Cancel subscription (soft delete via status)
 */
function handleDelete(PDO $pdo): void {
    $id = InputValidator::int($_GET['id'] ?? null);
    
    if (!$id) {
        ApiResponse::error('Subscription ID is required', 400);
        return;
    }
    
    try {
        // Soft delete by setting status to cancelled
        $stmt = $pdo->prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            ApiResponse::notFound('Subscription');
            return;
        }
        
        ApiResponse::success(['message' => 'Subscription cancelled successfully']);
        
    } catch (PDOException $e) {
        error_log('Error cancelling subscription: ' . $e->getMessage());
        ApiResponse::serverError('Failed to cancel subscription');
    }
}

/**
 * Calculate next payment date based on billing cycle
 */
function calculateNextPaymentDate(string $startDate, string $billingCycle): string {
    $date = new DateTime($startDate);
    
    if ($billingCycle === 'monthly') {
        $date->modify('+1 month');
    } else {
        $date->modify('+1 year');
    }
    
    return $date->format('Y-m-d');
}
