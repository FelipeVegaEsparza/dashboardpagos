<?php
/**
 * Users API Endpoint - Protected with Authentication
 * CRUD operations for user management (Admin only)
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
$currentUser = AuthMiddleware::requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;

    case 'POST':
        // Only admins can create users
        if ($currentUser['role'] !== 'admin') {
            ApiResponse::forbidden('Only administrators can create users');
        }
        handleCreate($pdo, $currentUser['id']);
        break;

    case 'PUT':
        // Only admins can update users (or users can update themselves with restrictions)
        handleUpdate($pdo, $currentUser);
        break;

    case 'DELETE':
        // Only admins can delete users
        if ($currentUser['role'] !== 'admin') {
            ApiResponse::forbidden('Only administrators can delete users');
        }
        handleDelete($pdo);
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - List users
 */
function handleGet(PDO $pdo): void {
    try {
        $userId = InputValidator::int($_GET['id'] ?? null);
        
        if ($userId) {
            // Get specific user (exclude password_hash)
            $stmt = $pdo->prepare("
                SELECT id, username, email, role, created_at, updated_at, last_login, is_active 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) {
                ApiResponse::notFound('User');
                return;
            }
            
            ApiResponse::success(['item' => $user]);
        } else {
            // Get all users (exclude password_hash)
            $stmt = $pdo->query("
                SELECT id, username, email, role, created_at, updated_at, last_login, is_active 
                FROM users 
                ORDER BY created_at DESC
            ");
            $users = $stmt->fetchAll();
            
            ApiResponse::success(['items' => $users]);
        }
        
    } catch (PDOException $e) {
        error_log('Error fetching users: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch users');
    }
}

/**
 * Handle POST request - Create new user
 */
function handleCreate(PDO $pdo, int $adminId): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('username', 'Username is required')
        ->length('username', 3, 50, 'Username must be between 3 and 50 characters')
        ->required('password', 'Password is required')
        ->length('password', 6, 255, 'Password must be at least 6 characters')
        ->email('email', 'Invalid email format')
        ->in('role', ['admin', 'user'], 'Role must be admin or user');
    
    $validator->throwIfFailed();
    
    $username = strtolower(trim($data['username']));
    $email = strtolower(trim($data['email']));
    $password = $data['password'];
    $role = $data['role'];
    
    try {
        // Check for duplicate username
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            ApiResponse::error('Username already exists', 409);
            return;
        }
        
        // Check for duplicate email
        if ($email) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                ApiResponse::error('Email already exists', 409);
                return;
            }
        }
        
        // Hash password
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        
        $stmt = $pdo->prepare("
            INSERT INTO users (username, password_hash, email, role, is_active, created_at)
            VALUES (?, ?, ?, ?, TRUE, NOW())
        ");
        $stmt->execute([$username, $passwordHash, $email, $role]);
        
        $id = $pdo->lastInsertId();
        
        ApiResponse::success([
            'id' => $id,
            'username' => $username,
            'email' => $email,
            'role' => $role,
            'message' => 'User created successfully'
        ], 201);
        
    } catch (PDOException $e) {
        error_log('Error creating user: ' . $e->getMessage());
        ApiResponse::serverError('Failed to create user');
    }
}

/**
 * Handle PUT request - Update user
 */
function handleUpdate(PDO $pdo, array $currentUser): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('id', 'User ID is required')
        ->numeric('id', 1, null, 'Invalid user ID');
    
    $validator->throwIfFailed();
    
    $userId = (int) $data['id'];
    $isAdmin = $currentUser['role'] === 'admin';
    $isSelf = $currentUser['id'] === $userId;
    
    // Non-admins can only update themselves
    if (!$isAdmin && !$isSelf) {
        ApiResponse::forbidden('You can only update your own profile');
        return;
    }
    
    try {
        // Check if user exists
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            ApiResponse::notFound('User');
            return;
        }
        
        $updates = [];
        $params = [];
        
        // Update username
        if (isset($data['username']) && $isAdmin) {
            $username = strtolower(trim($data['username']));
            
            // Check for duplicate
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
            $stmt->execute([$username, $userId]);
            if ($stmt->fetch()) {
                ApiResponse::error('Username already exists', 409);
                return;
            }
            
            $updates[] = "username = ?";
            $params[] = $username;
        }
        
        // Update email
        if (isset($data['email'])) {
            $email = strtolower(trim($data['email']));
            
            if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                ApiResponse::error('Invalid email format', 400);
                return;
            }
            
            // Check for duplicate
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
            $stmt->execute([$email, $userId]);
            if ($stmt->fetch()) {
                ApiResponse::error('Email already exists', 409);
                return;
            }
            
            $updates[] = "email = ?";
            $params[] = $email;
        }
        
        // Update role (admin only)
        if (isset($data['role']) && $isAdmin) {
            if (!in_array($data['role'], ['admin', 'user'])) {
                ApiResponse::error('Invalid role', 400);
                return;
            }
            
            // Prevent removing admin role from last admin
            if ($user['role'] === 'admin' && $data['role'] === 'user') {
                $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = TRUE");
                $adminCount = $stmt->fetchColumn();
                
                if ($adminCount <= 1) {
                    ApiResponse::error('Cannot demote the last admin', 409);
                    return;
                }
            }
            
            $updates[] = "role = ?";
            $params[] = $data['role'];
        }
        
        // Update password
        if (!empty($data['password'])) {
            if (strlen($data['password']) < 6) {
                ApiResponse::error('Password must be at least 6 characters', 400);
                return;
            }
            
            $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
            $updates[] = "password_hash = ?";
            $params[] = $passwordHash;
        }
        
        // Update is_active (admin only)
        if (isset($data['is_active']) && $isAdmin) {
            $isActive = (bool) $data['is_active'];
            
            // Prevent deactivating last admin
            if (!$isActive && $user['role'] === 'admin') {
                $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = TRUE");
                $adminCount = $stmt->fetchColumn();
                
                if ($adminCount <= 1) {
                    ApiResponse::error('Cannot deactivate the last admin', 409);
                    return;
                }
            }
            
            $updates[] = "is_active = ?";
            $params[] = $isActive ? 1 : 0;
        }
        
        if (empty($updates)) {
            ApiResponse::error('No fields to update', 400);
            return;
        }
        
        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
        $params[] = $userId;
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        ApiResponse::success([
            'id' => $userId,
            'message' => 'User updated successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Error updating user: ' . $e->getMessage());
        ApiResponse::serverError('Failed to update user');
    }
}

/**
 * Handle DELETE request - Delete user (soft delete via is_active)
 */
function handleDelete(PDO $pdo): void {
    $id = InputValidator::int($_GET['id'] ?? null);
    
    if (!$id) {
        ApiResponse::error('User ID is required', 400);
        return;
    }
    
    try {
        // Get user info
        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        
        if (!$user) {
            ApiResponse::notFound('User');
            return;
        }
        
        // Prevent deleting last admin
        if ($user['role'] === 'admin') {
            $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = TRUE");
            $adminCount = $stmt->fetchColumn();
            
            if ($adminCount <= 1) {
                ApiResponse::error('Cannot delete the last admin', 409);
                return;
            }
        }
        
        // Soft delete by deactivating
        $stmt = $pdo->prepare("UPDATE users SET is_active = FALSE WHERE id = ?");
        $stmt->execute([$id]);
        
        // Delete refresh tokens
        $stmt = $pdo->prepare("DELETE FROM refresh_tokens WHERE user_id = ?");
        $stmt->execute([$id]);
        
        ApiResponse::success(['message' => 'User deleted successfully']);
        
    } catch (PDOException $e) {
        error_log('Error deleting user: ' . $e->getMessage());
        ApiResponse::serverError('Failed to delete user');
    }
}
