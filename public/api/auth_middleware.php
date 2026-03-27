<?php
/**
 * Authentication Middleware
 * Include this at the top of protected endpoints
 * 
 * Usage:
 *   require_once 'auth_middleware.php';
 *   // If we reach here, user is authenticated
 *   $currentUser = AuthMiddleware::getCurrentUser();
 */

require_once 'jwt.php';

class AuthMiddleware {
    private static $currentUser = null;
    private static $tokenPayload = null;
    
    /**
     * Require authentication - throws 401 if not authenticated
     * 
     * @param array $requiredRoles Optional array of allowed roles (e.g., ['admin'])
     * @return array User data
     * @throws Exception If authentication fails
     */
    public static function requireAuth(array $requiredRoles = []): array {
        $token = JWT::getBearerToken();
        
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            exit;
        }
        
        try {
            $payload = JWT::verify($token);
            
            // Check blacklist
            if (isset($payload['jti']) && TokenBlacklist::isBlacklisted($payload['jti'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Token revoked. Please login again.']);
                exit;
            }
            
            // Check role requirements
            if (!empty($requiredRoles)) {
                $userRole = $payload['role'] ?? 'user';
                if (!in_array($userRole, $requiredRoles)) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Insufficient permissions']);
                    exit;
                }
            }
            
            self::$tokenPayload = $payload;
            self::$currentUser = [
                'id' => $payload['sub'],
                'username' => $payload['username'] ?? null,
                'email' => $payload['email'] ?? null,
                'role' => $payload['role'] ?? 'user'
            ];
            
            return self::$currentUser;
            
        } catch (Exception $e) {
            if ($e->getMessage() === 'Token expired') {
                http_response_code(401);
                echo json_encode(['error' => 'Token expired', 'code' => 'TOKEN_EXPIRED']);
            } else {
                http_response_code(401);
                echo json_encode(['error' => 'Invalid token']);
            }
            exit;
        }
    }
    
    /**
     * Optional authentication - returns user data or null
     * 
     * @return array|null User data or null
     */
    public static function optionalAuth(): ?array {
        $token = JWT::getBearerToken();
        
        if (!$token) {
            return null;
        }
        
        try {
            $payload = JWT::verify($token);
            
            // Check blacklist
            if (isset($payload['jti']) && TokenBlacklist::isBlacklisted($payload['jti'])) {
                return null;
            }
            
            self::$tokenPayload = $payload;
            self::$currentUser = [
                'id' => $payload['sub'],
                'username' => $payload['username'] ?? null,
                'email' => $payload['email'] ?? null,
                'role' => $payload['role'] ?? 'user'
            ];
            
            return self::$currentUser;
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Get current authenticated user
     * Must call requireAuth() or optionalAuth() first
     * 
     * @return array|null
     */
    public static function getCurrentUser(): ?array {
        return self::$currentUser;
    }
    
    /**
     * Get token payload (includes exp, iat, etc.)
     * 
     * @return array|null
     */
    public static function getTokenPayload(): ?array {
        return self::$tokenPayload;
    }
    
    /**
     * Check if user has specific role
     * 
     * @param string $role
     * @return bool
     */
    public static function hasRole(string $role): bool {
        if (!self::$currentUser) {
            return false;
        }
        return (self::$currentUser['role'] ?? 'user') === $role;
    }
    
    /**
     * Require admin role
     */
    public static function requireAdmin(): array {
        return self::requireAuth(['admin']);
    }
    
    /**
     * Get user ID from token
     * 
     * @return int|null
     */
    public static function getUserId(): ?int {
        return self::$currentUser['id'] ?? null;
    }
}

/**
 * Helper function for quick auth check
 * 
 * @param array $requiredRoles
 * @return array
 */
function auth(array $requiredRoles = []): array {
    return AuthMiddleware::requireAuth($requiredRoles);
}

/**
 * Helper function to require admin
 * 
 * @return array
 */
function adminOnly(): array {
    return AuthMiddleware::requireAdmin();
}

// Handle CORS preflight for protected endpoints
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
