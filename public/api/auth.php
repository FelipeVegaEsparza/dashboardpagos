<?php
/**
 * Authentication API Endpoint
 * Optimized with rate limiting and secure password handling
 */

require_once 'config.php';
require_once 'jwt.php';

// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 300; // 5 minutes
const RATE_LIMIT_WINDOW = 3600; // 1 hour

// Set JSON content type
header('Content-Type: application/json; charset=utf-8');

/**
 * Simple file-based rate limiting
 * In production, use Redis
 */
class RateLimiter {
    private static $dir = __DIR__ . '/rate_limits/';
    
    public static function check(string $identifier): bool {
        if (!is_dir(self::$dir)) {
            mkdir(self::$dir, 0750, true);
        }
        
        $file = self::$dir . md5($identifier) . '.json';
        $now = time();
        
        $data = ['attempts' => 0, 'first_attempt' => $now, 'locked_until' => 0];
        
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
        }
        
        // Check if locked
        if ($data['locked_until'] > $now) {
            $remaining = $data['locked_until'] - $now;
            http_response_code(429);
            echo json_encode(['error' => 'Too many attempts. Try again in ' . ceil($remaining / 60) . ' minutes.']);
            exit;
        }
        
        // Reset if window passed
        if ($now - $data['first_attempt'] > RATE_LIMIT_WINDOW) {
            $data = ['attempts' => 0, 'first_attempt' => $now, 'locked_until' => 0];
        }
        
        return true;
    }
    
    public static function recordAttempt(string $identifier, bool $success): void {
        $file = self::$dir . md5($identifier) . '.json';
        $now = time();
        
        $data = ['attempts' => 0, 'first_attempt' => $now, 'locked_until' => 0];
        
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
        }
        
        if ($success) {
            // Clear on success
            if (file_exists($file)) {
                unlink($file);
            }
            return;
        }
        
        $data['attempts']++;
        
        // Lock if max attempts reached
        if ($data['attempts'] >= MAX_ATTEMPTS) {
            $data['locked_until'] = $now + LOCKOUT_TIME;
        }
        
        file_put_contents($file, json_encode($data), LOCK_EX);
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

switch ($method) {
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        
        switch ($action) {
            case 'login':
                handleLogin($input, $ipAddress);
                break;
                
            case 'logout':
                handleLogout();
                break;
                
            case 'refresh':
                handleRefresh($input);
                break;
                
            case 'verify':
                handleVerify();
                break;
                
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Invalid action']);
        }
        break;
        
    case 'GET':
        // Verify token on GET request
        handleVerify();
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

/**
 * Handle user login
 */
function handleLogin(array $input, string $ipAddress): void {
    // Rate limiting by IP and username
    $username = $input['username'] ?? '';
    RateLimiter::check($ipAddress . ':' . $username);
    
    // Validate input
    if (empty($username) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password required']);
        return;
    }
    
    global $pdo;
    
    // Check if database connection is available
    if (!isset($pdo) || $pdo === null) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection not available']);
        return;
    }
    
    try {
        // Fetch user
        $stmt = $pdo->prepare("SELECT id, username, password_hash, email, role, is_active FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        // Verify password (constant time comparison)
        if (!$user || !password_verify($input['password'], $user['password_hash'])) {
            RateLimiter::recordAttempt($ipAddress . ':' . $username, false);
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }
        
        // Check if user is active
        if (!$user['is_active']) {
            http_response_code(403);
            echo json_encode(['error' => 'Account disabled']);
            return;
        }
        
        // Update last login
        $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$user['id']]);
        
        // Generate tokens
        $accessPayload = [
            'sub' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ];
        
        $accessToken = JWT::generate($accessPayload, 900); // 15 minutes
        $refreshToken = JWT::generateRefreshToken();
        
        // Store refresh token hash in database (for revocation)
        $refreshHash = hash('sha256', $refreshToken);
        $expiresAt = date('Y-m-d H:i:s', time() + 604800); // 7 days
        
        $stmt = $pdo->prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['id'], $refreshHash, $expiresAt]);
        
        RateLimiter::recordAttempt($ipAddress . ':' . $username, true);
    } catch (PDOException $e) {
        error_log('Database error during login: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Database error. Please try again later.']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_in' => 900,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
}

/**
 * Handle logout - blacklist token and delete refresh token
 */
function handleLogout(): void {
    $token = JWT::getBearerToken();
    
    if ($token) {
        try {
            $payload = JWT::verify($token);
            // Add to blacklist until expiration
            if (isset($payload['jti']) && isset($payload['exp'])) {
                TokenBlacklist::add($payload['jti'], $payload['exp']);
            }
        } catch (Exception $e) {
            // Token invalid, continue with logout anyway
        }
    }
    
    // Delete refresh token if provided
    $input = json_decode(file_get_contents('php://input'), true);
    if (!empty($input['refresh_token'])) {
        global $pdo;
        $refreshHash = hash('sha256', $input['refresh_token']);
        $stmt = $pdo->prepare("DELETE FROM refresh_tokens WHERE token_hash = ?");
        $stmt->execute([$refreshHash]);
    }
    
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
}

/**
 * Handle token refresh
 */
function handleRefresh(array $input): void {
    if (empty($input['refresh_token'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Refresh token required']);
        return;
    }
    
    $refreshToken = $input['refresh_token'];
    $refreshHash = hash('sha256', $refreshToken);
    
    global $pdo;
    
    // Verify refresh token exists and is not expired
    $stmt = $pdo->prepare("
        SELECT rt.*, u.username, u.email, u.role, u.is_active 
        FROM refresh_tokens rt 
        JOIN users u ON rt.user_id = u.id 
        WHERE rt.token_hash = ? AND rt.expires_at > NOW()
    ");
    $stmt->execute([$refreshHash]);
    $tokenData = $stmt->fetch();
    
    if (!$tokenData) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired refresh token']);
        return;
    }
    
    if (!$tokenData['is_active']) {
        http_response_code(403);
        echo json_encode(['error' => 'Account disabled']);
        return;
    }
    
    // Generate new access token
    $accessPayload = [
        'sub' => $tokenData['user_id'],
        'username' => $tokenData['username'],
        'email' => $tokenData['email'],
        'role' => $tokenData['role']
    ];
    
    $newAccessToken = JWT::generate($accessPayload, 900);
    
    // Optionally rotate refresh token (security best practice)
    $newRefreshToken = JWT::generateRefreshToken();
    $newRefreshHash = hash('sha256', $newRefreshToken);
    $expiresAt = date('Y-m-d H:i:s', time() + 604800);
    
    $pdo->beginTransaction();
    try {
        // Delete old refresh token
        $stmt = $pdo->prepare("DELETE FROM refresh_tokens WHERE token_hash = ?");
        $stmt->execute([$refreshHash]);
        
        // Insert new refresh token
        $stmt = $pdo->prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$tokenData['user_id'], $newRefreshHash, $expiresAt]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'access_token' => $newAccessToken,
            'refresh_token' => $newRefreshToken,
            'expires_in' => 900
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Token rotation failed']);
    }
}

/**
 * Verify current token and return user info
 */
function handleVerify(): void {
    $token = JWT::getBearerToken();
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    try {
        $payload = JWT::verify($token);
        
        // Check blacklist
        if (isset($payload['jti']) && TokenBlacklist::isBlacklisted($payload['jti'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Token revoked']);
            return;
        }
        
        echo json_encode([
            'valid' => true,
            'user' => [
                'id' => $payload['sub'],
                'username' => $payload['username'] ?? null,
                'email' => $payload['email'] ?? null,
                'role' => $payload['role'] ?? null
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
