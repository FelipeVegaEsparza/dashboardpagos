<?php
/**
 * JWT Implementation - Optimized for security and performance
 * Uses HS256 algorithm with secure key management
 */

class JWT {
    private static $algorithm = 'HS256';
    private static $allowedAlgorithms = ['HS256'];
    
    /**
     * Generate JWT token
     * 
     * @param array $payload Data to encode
     * @param int $expirySeconds Token lifetime (default: 24 hours)
     * @return string JWT token
     */
    public static function generate(array $payload, int $expirySeconds = 86400): string {
        $secret = self::getSecret();
        
        $header = json_encode([
            'typ' => 'JWT',
            'alg' => self::$algorithm
        ]);
        
        $time = time();
        $payload['iat'] = $time;                    // Issued at
        $payload['exp'] = $time + $expirySeconds;   // Expiration
        $payload['jti'] = bin2hex(random_bytes(16)); // Unique token ID for revocation
        
        $payloadJson = json_encode($payload);
        
        // Encode header and payload
        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode($payloadJson);
        
        // Create signature
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $secret, true);
        $base64Signature = self::base64UrlEncode($signature);
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }
    
    /**
     * Verify and decode JWT token
     * 
     * @param string $token JWT token
     * @return array Decoded payload
     * @throws Exception If token is invalid or expired
     */
    public static function verify(string $token): array {
        $secret = self::getSecret();
        
        // Split token
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new Exception('Invalid token format');
        }
        
        list($base64Header, $base64Payload, $base64Signature) = $parts;
        
        // Decode header
        $header = json_decode(self::base64UrlDecode($base64Header), true);
        if (!$header || !isset($header['alg'])) {
            throw new Exception('Invalid header');
        }
        
        // Verify algorithm (prevent algorithm confusion attacks)
        if (!in_array($header['alg'], self::$allowedAlgorithms)) {
            throw new Exception('Algorithm not allowed');
        }
        
        // Verify signature
        $signature = self::base64UrlDecode($base64Signature);
        $expectedSignature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $secret, true);
        
        if (!hash_equals($signature, $expectedSignature)) {
            throw new Exception('Invalid signature');
        }
        
        // Decode payload
        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        if (!$payload) {
            throw new Exception('Invalid payload');
        }
        
        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new Exception('Token expired');
        }
        
        // Check not before (if set)
        if (isset($payload['nbf']) && $payload['nbf'] > time()) {
            throw new Exception('Token not yet valid');
        }
        
        return $payload;
    }
    
    /**
     * Extract token from Authorization header
     * 
     * @return string|null Token or null if not found
     */
    public static function getBearerToken(): ?string {
        $headers = null;
        
        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER['Authorization']);
        } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }
        
        if (!$headers) {
            return null;
        }
        
        // Check for Bearer token
        if (preg_match('/Bearer\s+(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
        
        return null;
    }
    
    /**
     * Get secret key from environment
     * Generates a secure key if not set (for development only)
     * 
     * @return string Secret key
     */
    private static function getSecret(): string {
        $secret = getenv('JWT_SECRET');
        
        if (!$secret) {
            // Fallback for development - NOT FOR PRODUCTION
            error_log('WARNING: JWT_SECRET not set, using default. Set JWT_SECRET in production!');
            $secret = 'dev_secret_change_in_production_' . (getenv('DB_PASSWORD') ?: 'fallback');
        }
        
        return $secret;
    }
    
    /**
     * Base64URL encode (URL-safe base64)
     */
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    /**
     * Base64URL decode
     */
    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }
    
    /**
     * Generate a secure random refresh token
     * 
     * @return string Refresh token
     */
    public static function generateRefreshToken(): string {
        return bin2hex(random_bytes(32));
    }
}

/**
 * Simple token blacklist for logout functionality
 * In production, use Redis or database
 */
class TokenBlacklist {
    private static $file = __DIR__ . '/token_blacklist.txt';
    
    /**
     * Add token to blacklist until its expiration
     */
    public static function add(string $jti, int $exp): void {
        $entry = $jti . '|' . $exp . PHP_EOL;
        file_put_contents(self::$file, $entry, FILE_APPEND | LOCK_EX);
        self::cleanup();
    }
    
    /**
     * Check if token is blacklisted
     */
    public static function isBlacklisted(string $jti): bool {
        if (!file_exists(self::$file)) {
            return false;
        }
        
        $content = file_get_contents(self::$file);
        $lines = explode(PHP_EOL, $content);
        
        foreach ($lines as $line) {
            if (empty($line)) continue;
            list($tokenJti, $exp) = explode('|', $line);
            if ($tokenJti === $jti) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Remove expired tokens from blacklist
     */
    private static function cleanup(): void {
        if (!file_exists(self::$file)) {
            return;
        }
        
        $content = file_get_contents(self::$file);
        $lines = explode(PHP_EOL, $content);
        $now = time();
        $valid = [];
        
        foreach ($lines as $line) {
            if (empty($line)) continue;
            list($jti, $exp) = explode('|', $line);
            if ($exp > $now) {
                $valid[] = $line;
            }
        }
        
        file_put_contents(self::$file, implode(PHP_EOL, $valid) . PHP_EOL, LOCK_EX);
    }
}
