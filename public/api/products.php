<?php
/**
 * Products API Endpoint - Protected with Authentication
 * Optimized with validation and relationship checks
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
 * Handle GET request - List products
 */
function handleGet(PDO $pdo): void {
    $serviceId = InputValidator::int($_GET['service_id'] ?? null);
    $productId = InputValidator::int($_GET['id'] ?? null);
    
    try {
        if ($productId) {
            // Get single product
            $stmt = $pdo->prepare("
                SELECT p.*, s.name as service_name 
                FROM products p
                JOIN services s ON p.service_id = s.id
                WHERE p.id = ?
            ");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            
            if (!$product) {
                ApiResponse::notFound('Product');
                return;
            }
            
            ApiResponse::success(['item' => $product]);
            
        } elseif ($serviceId) {
            // Get products for specific service
            $stmt = $pdo->prepare("
                SELECT * FROM products 
                WHERE service_id = ? 
                ORDER BY price ASC
            ");
            $stmt->execute([$serviceId]);
            $products = $stmt->fetchAll();
            
            ApiResponse::success(['items' => $products]);
            
        } else {
            // Get all products with service info
            $stmt = $pdo->query("
                SELECT p.*, s.name as service_name 
                FROM products p
                JOIN services s ON p.service_id = s.id
                ORDER BY s.name, p.price
            ");
            $products = $stmt->fetchAll();
            
            ApiResponse::success(['items' => $products]);
        }
        
    } catch (PDOException $e) {
        error_log('Error fetching products: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch products');
    }
}

/**
 * Handle POST request - Create product
 */
function handlePost(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('service_id', 'Service ID is required')
        ->numeric('service_id', 1, null, 'Invalid service ID')
        ->required('name', 'Product name is required')
        ->length('name', 2, 255)
        ->required('price', 'Price is required')
        ->numeric('price', 0.01, 999999999.99, 'Price must be between 0.01 and 999,999,999.99')
        ->in('billing_cycle', ['monthly', 'yearly'], 'Invalid billing cycle');
    
    $validator->throwIfFailed();
    
    $serviceId = (int) $data['service_id'];
    $name = InputValidator::sanitize($data['name']);
    $price = (float) $data['price'];
    $billingCycle = $data['billing_cycle'];
    
    try {
        // Verify service exists
        $stmt = $pdo->prepare("SELECT id FROM services WHERE id = ?");
        $stmt->execute([$serviceId]);
        if (!$stmt->fetch()) {
            ApiResponse::error('Service not found', 404);
            return;
        }
        
        // Check for duplicate product name in same service
        $stmt = $pdo->prepare("SELECT id FROM products WHERE service_id = ? AND name = ?");
        $stmt->execute([$serviceId, $name]);
        if ($stmt->fetch()) {
            ApiResponse::error('A product with this name already exists for this service', 409);
            return;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO products (service_id, name, price, billing_cycle) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$serviceId, $name, $price, $billingCycle]);
        
        $id = $pdo->lastInsertId();
        
        ApiResponse::success([
            'id' => $id,
            'service_id' => $serviceId,
            'name' => $name,
            'price' => $price,
            'billing_cycle' => $billingCycle,
            'message' => 'Product created successfully'
        ], 201);
        
    } catch (PDOException $e) {
        error_log('Error creating product: ' . $e->getMessage());
        ApiResponse::serverError('Failed to create product');
    }
}

/**
 * Handle PUT request - Update product
 */
function handlePut(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('id', 'Product ID is required')
        ->numeric('id', 1, null, 'Invalid product ID')
        ->required('name', 'Product name is required')
        ->length('name', 2, 255)
        ->required('price', 'Price is required')
        ->numeric('price', 0.01, 999999999.99)
        ->in('billing_cycle', ['monthly', 'yearly']);
    
    $validator->throwIfFailed();
    
    $id = (int) $data['id'];
    $name = InputValidator::sanitize($data['name']);
    $price = (float) $data['price'];
    $billingCycle = $data['billing_cycle'];
    
    try {
        // Check if product exists
        $stmt = $pdo->prepare("SELECT service_id FROM products WHERE id = ?");
        $stmt->execute([$id]);
        $product = $stmt->fetch();
        
        if (!$product) {
            ApiResponse::notFound('Product');
            return;
        }
        
        // Check for duplicate name (excluding current product)
        $stmt = $pdo->prepare("
            SELECT id FROM products 
            WHERE service_id = ? AND name = ? AND id != ?
        ");
        $stmt->execute([$product['service_id'], $name, $id]);
        if ($stmt->fetch()) {
            ApiResponse::error('Another product with this name already exists for this service', 409);
            return;
        }
        
        $stmt = $pdo->prepare("
            UPDATE products 
            SET name = ?, price = ?, billing_cycle = ? 
            WHERE id = ?
        ");
        $stmt->execute([$name, $price, $billingCycle, $id]);
        
        ApiResponse::success([
            'id' => $id,
            'name' => $name,
            'price' => $price,
            'billing_cycle' => $billingCycle,
            'message' => 'Product updated successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Error updating product: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update product');
    }
}

/**
 * Handle DELETE request - Delete product
 */
function handleDelete(PDO $pdo): void {
    $id = InputValidator::int($_GET['id'] ?? null);
    
    if (!$id) {
        ApiResponse::error('Product ID is required', 400);
        return;
    }
    
    try {
        // Check for active subscriptions
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM subscriptions WHERE product_id = ?");
        $stmt->execute([$id]);
        $subscriptionCount = $stmt->fetchColumn();
        
        if ($subscriptionCount > 0) {
            ApiResponse::error(
                'Cannot delete product with active subscriptions. Please delete or reassign subscriptions first.', 
                409
            );
            return;
        }
        
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            ApiResponse::notFound('Product');
            return;
        }
        
        ApiResponse::success(['message' => 'Product deleted successfully']);
        
    } catch (PDOException $e) {
        error_log('Error deleting product: ' . $e->getMessage());
        ApiResponse::serverError('Failed to delete product');
    }
}
