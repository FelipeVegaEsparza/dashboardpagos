<?php
/**
 * API Configuration
 * Centralized CORS, database connection, and utility functions
 */

// Helper function to read environment variables from multiple sources
function env($key, $default = null) {
    // Try getenv() first
    $value = getenv($key);
    if ($value !== false && $value !== '') {
        return $value;
    }
    // Try $_ENV
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }
    // Try $_SERVER
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return $_SERVER[$key];
    }
    return $default;
}

// Error handling - don't expose sensitive info in production
$isProduction = env('ENVIRONMENT') === 'production';
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

// Register shutdown function to catch fatal errors and return JSON
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && ($error['type'] & (E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR | E_USER_ERROR))) {
        // Clear any output that might have been sent
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        
        $isProduction = getenv('ENVIRONMENT') === 'production';
        $message = $isProduction 
            ? 'Internal server error. Please try again later.' 
            : 'Fatal error: ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line'];
        
        echo json_encode([
            'success' => false,
            'error' => $message
        ]);
        exit;
    }
});

// CORS Configuration
$allowedOrigins = [
    'http://localhost:5173',    // Vite dev server
    'http://localhost:3000',    // Alternative dev port
    'http://localhost:80',
    'http://localhost',
];

// Add production origins from environment
$productionOrigins = getenv('ALLOWED_ORIGINS');
if ($productionOrigins) {
    $origins = explode(',', $productionOrigins);
    $allowedOrigins = array_merge($allowedOrigins, array_map('trim', $origins));
}

$allowedOrigins = array_unique(array_filter($allowedOrigins));

// Get request origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Validate and set CORS headers
// Allow requests with no origin (same-origin requests through proxy)
if (empty($origin)) {
    // Same-origin request - no CORS headers needed
} elseif (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}

header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Configuration
$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'payments_db';
$user = getenv('DB_USER') ?: 'user';
$pass = getenv('DB_PASSWORD') ?: 'password';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_STRINGIFY_FETCHES  => false,
    PDO::ATTR_ORACLE_NULLS       => PDO::NULL_NATURAL,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    $errorMsg = $isProduction 
        ? 'Database connection failed' 
        : 'Database connection failed: ' . $e->getMessage();
    echo json_encode(['error' => $errorMsg]);
    exit;
}

/**
 * API Response Helper Class
 * Ensures consistent response format across all endpoints
 */
class ApiResponse {
    
    /**
     * Success response
     */
    public static function success(array $data = [], int $code = 200): void {
        http_response_code($code);
        echo json_encode([
            'success' => true,
            'data' => $data,
            'meta' => [
                'timestamp' => time(),
                'request_id' => uniqid()
            ]
        ]);
    }
    
    /**
     * Error response
     */
    public static function error(string $message, int $code = 400, array $details = []): void {
        http_response_code($code);
        $response = [
            'success' => false,
            'error' => [
                'message' => $message,
                'code' => $code
            ],
            'meta' => [
                'timestamp' => time(),
                'request_id' => uniqid()
            ]
        ];
        
        if (!empty($details)) {
            $response['error']['details'] = $details;
        }
        
        echo json_encode($response);
    }
    
    /**
     * Validation error response
     */
    public static function validationError(array $errors): void {
        self::error('Validation failed', 422, $errors);
    }
    
    /**
     * Not found response
     */
    public static function notFound(string $resource = 'Resource'): void {
        self::error($resource . ' not found', 404);
    }
    
    /**
     * Unauthorized response
     */
    public static function unauthorized(string $message = 'Authentication required'): void {
        self::error($message, 401);
    }
    
    /**
     * Forbidden response
     */
    public static function forbidden(string $message = 'Insufficient permissions'): void {
        self::error($message, 403);
    }
    
    /**
     * Server error response
     */
    public static function serverError(string $message = 'Internal server error'): void {
        $isProduction = getenv('ENVIRONMENT') === 'production';
        self::error($isProduction ? $message : $message, 500);
    }
}

/**
 * Input Validation Helper Class
 */
class InputValidator {
    
    private $errors = [];
    private $data = [];
    
    public function __construct(array $data) {
        $this->data = $data;
    }
    
    /**
     * Validate required field
     */
    public function required(string $field, string $customMessage = null): self {
        if (!isset($this->data[$field]) || trim($this->data[$field]) === '') {
            $this->errors[$field] = $customMessage ?? "The field '$field' is required";
        }
        return $this;
    }
    
    /**
     * Validate email
     */
    public function email(string $field, string $customMessage = null): self {
        if (isset($this->data[$field]) && !filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = $customMessage ?? "The field '$field' must be a valid email";
        }
        return $this;
    }
    
    /**
     * Validate string length
     */
    public function length(string $field, int $min = 0, int $max = 255, string $customMessage = null): self {
        if (isset($this->data[$field])) {
            $len = strlen($this->data[$field]);
            if ($len < $min || $len > $max) {
                $this->errors[$field] = $customMessage ?? "The field '$field' must be between $min and $max characters";
            }
        }
        return $this;
    }
    
    /**
     * Validate numeric
     */
    public function numeric(string $field, float $min = null, float $max = null, string $customMessage = null): self {
        if (isset($this->data[$field])) {
            if (!is_numeric($this->data[$field])) {
                $this->errors[$field] = $customMessage ?? "The field '$field' must be numeric";
            } elseif ($min !== null && $this->data[$field] < $min) {
                $this->errors[$field] = $customMessage ?? "The field '$field' must be at least $min";
            } elseif ($max !== null && $this->data[$field] > $max) {
                $this->errors[$field] = $customMessage ?? "The field '$field' must be at most $max";
            }
        }
        return $this;
    }
    
    /**
     * Validate date format
     */
    public function date(string $field, string $format = 'Y-m-d', string $customMessage = null): self {
        if (isset($this->data[$field])) {
            $d = DateTime::createFromFormat($format, $this->data[$field]);
            if (!$d || $d->format($format) !== $this->data[$field]) {
                $this->errors[$field] = $customMessage ?? "The field '$field' must be a valid date ($format)";
            }
        }
        return $this;
    }
    
    /**
     * Validate enum values
     */
    public function in(string $field, array $allowed, string $customMessage = null): self {
        if (isset($this->data[$field]) && !in_array($this->data[$field], $allowed)) {
            $this->errors[$field] = $customMessage ?? "The field '$field' must be one of: " . implode(', ', $allowed);
        }
        return $this;
    }
    
    /**
     * Sanitize string
     */
    public static function sanitize(string $input): string {
        return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * Get integer value safely
     */
    public static function int($value, int $default = 0): int {
        return filter_var($value, FILTER_VALIDATE_INT) ?: $default;
    }
    
    /**
     * Check if validation passed
     */
    public function passes(): bool {
        return empty($this->errors);
    }
    
    /**
     * Get validation errors
     */
    public function errors(): array {
        return $this->errors;
    }
    
    /**
     * Throw validation error if fails
     */
    public function throwIfFailed(): void {
        if (!$this->passes()) {
            ApiResponse::validationError($this->errors);
            exit;
        }
    }
}

/**
 * Pagination Helper
 */
class Pagination {
    
    /**
     * Get pagination parameters from request
     */
    public static function getParams(int $defaultLimit = 20, int $maxLimit = 100): array {
        $page = InputValidator::int($_GET['page'] ?? 1, 1);
        $limit = InputValidator::int($_GET['limit'] ?? $defaultLimit, $defaultLimit);
        
        // Clamp limit
        $limit = min(max($limit, 1), $maxLimit);
        
        $offset = ($page - 1) * $limit;
        
        return [
            'page' => $page,
            'limit' => $limit,
            'offset' => $offset
        ];
    }
    
    /**
     * Create pagination metadata
     */
    public static function meta(int $page, int $limit, int $total): array {
        $totalPages = (int) ceil($total / $limit);
        
        return [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => $totalPages,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        ];
    }
}
