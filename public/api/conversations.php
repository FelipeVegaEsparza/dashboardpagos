<?php
/**
 * Email Conversations API Endpoint
 * Read and manage email conversations with clients
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
AuthMiddleware::requireAuth();

// Check if IMAP extension is available (optional - for native IMAP)
$imap_available = extension_loaded('imap') || class_exists('PHPMailer\PHPMailer\PHPMailer');

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo, $imap_available);
        break;

    case 'POST':
        handlePost($pdo);
        break;

    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - Get conversations or fetch new emails
 */
function handleGet(PDO $pdo, bool $imap_available): void {
    $action = $_GET['action'] ?? 'list';
    
    switch ($action) {
        case 'fetch':
            if (!$imap_available) {
                ApiResponse::error('IMAP extension not available', 500);
                return;
            }
            fetchNewEmails($pdo);
            break;
            
        case 'list':
        default:
            listConversations($pdo);
            break;
    }
}

/**
 * Handle POST request - Mark as read, reply, etc.
 */
function handlePost(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'mark_read':
            markAsRead($pdo, $data);
            break;
            
        case 'reply':
            sendReply($pdo, $data);
            break;
            
        default:
            ApiResponse::error('Invalid action', 400);
    }
}

/**
 * List email conversations
 */
function listConversations(PDO $pdo): void {
    try {
        // Get client filter
        $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : null;
        $unreadOnly = ($_GET['unread_only'] ?? '') === 'true';
        
        // Ensure table exists
        ensureConversationsTable($pdo);
        
        $where = [];
        $params = [];
        
        if ($clientId) {
            $where[] = "c.client_id = :client_id";
            $params[':client_id'] = $clientId;
        }
        
        if ($unreadOnly) {
            $where[] = "c.is_read = 0";
        }
        
        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        
        // Get conversations grouped by client
        $sql = "
            SELECT 
                c.id, c.client_id, c.subscription_id,
                c.subject, c.body, c.email_from, c.email_to,
                c.is_read, c.is_outgoing,
                c.created_at,
                cl.name as client_name,
                s.service_name, s.product_name
            FROM email_conversations c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN (
                SELECT 
                    s.id, 
                    serv.name as service_name,
                    p.name as product_name
                FROM subscriptions s
                JOIN services serv ON p.service_id = serv.id
                JOIN products p ON s.product_id = p.id
            ) s ON c.subscription_id = s.id
            $whereClause
            ORDER BY c.created_at DESC
            LIMIT 100
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $conversations = $stmt->fetchAll();
        
        // Get unread count
        $unreadStmt = $pdo->query("SELECT COUNT(*) FROM email_conversations WHERE is_read = 0 AND is_outgoing = 0");
        $unreadCount = $unreadStmt->fetchColumn();
        
        ApiResponse::success([
            'conversations' => $conversations,
            'unread_count' => $unreadCount,
            'imap_available' => extension_loaded('imap')
        ]);
        
    } catch (PDOException $e) {
        error_log('Error listing conversations: ' . $e->getMessage());
        ApiResponse::serverError('Failed to list conversations');
    }
}

/**
 * Fetch new emails from IMAP server
 * Note: Requires PHP IMAP extension or manual webhook setup
 */
function fetchNewEmails(PDO $pdo): void {
    // Check if native IMAP extension is available
    if (!extension_loaded('imap')) {
        // Alternative: Use email forwarding/webhook approach
        // For now, return instructions
        ApiResponse::success([
            'message' => 'IMAP extension not available in this environment',
            'note' => 'To enable automatic email fetching, either:\n1. Enable PHP IMAP extension on server\n2. Set up email forwarding to a webhook\n3. Use manual email import',
            'imap_available' => false
        ]);
        return;
    }
    
    $imapHost = getenv('IMAP_HOST');
    $imapPort = (int)(getenv('IMAP_PORT') ?: 993);
    $imapUser = getenv('IMAP_USER');
    $imapPass = getenv('IMAP_PASS');
    $imapSSL = filter_var(getenv('IMAP_SSL') ?? 'true', FILTER_VALIDATE_BOOLEAN);
    
    if (!$imapHost || !$imapUser || !$imapPass) {
        ApiResponse::error('IMAP not configured', 500);
        return;
    }
    
    try {
        // Connect to IMAP server
        $sslFlag = $imapSSL ? '/ssl' : '';
        $mailbox = "{{$imapHost}:{$imapPort}/imap{$sslFlag}}INBOX";
        
        $connection = imap_open($mailbox, $imapUser, $imapPass, OP_READONLY);
        
        if (!$connection) {
            $error = imap_last_error();
            error_log('IMAP Connection Error: ' . $error);
            ApiResponse::error('Failed to connect to email server: ' . $error, 500);
            return;
        }
        
        // Search for unread emails
        $emails = imap_search($connection, 'UNSEEN', SE_UID);
        
        $imported = 0;
        
        if ($emails) {
            // Ensure table exists
            ensureConversationsTable($pdo);
            
            foreach ($emails as $emailUid) {
                $header = imap_rfc822_parse_headers(imap_fetchheader($connection, $emailUid, FT_UID));
                $body = imap_fetchbody($connection, $emailUid, 1, FT_UID);
                
                // Get plain text if HTML
                $structure = imap_fetchstructure($connection, $emailUid, FT_UID);
                if (isset($structure->parts) && $structure->parts) {
                    $body = getPart($connection, $emailUid, $structure, 'TEXT/PLAIN') ?: $body;
                }
                
                // Decode body
                $body = decodeBody($body, $structure->encoding ?? 0);
                
                // Extract sender email
                $from = $header->from[0]->mailbox . '@' . $header->from[0]->host;
                $subject = $header->subject ?? 'No Subject';
                $subject = decodeMimeHeader($subject);
                
                // Find client by email
                $clientStmt = $pdo->prepare("SELECT id FROM clients WHERE email = ?");
                $clientStmt->execute([$from]);
                $client = $clientStmt->fetch();
                
                if ($client) {
                    // Check if already imported
                    $checkStmt = $pdo->prepare("
                        SELECT id FROM email_conversations 
                        WHERE email_from = ? AND subject = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
                    ");
                    $checkStmt->execute([$from, $subject]);
                    
                    if (!$checkStmt->fetch()) {
                        // Find subscription by client
                        $subStmt = $pdo->prepare("
                            SELECT id FROM subscriptions 
                            WHERE client_id = ? AND status = 'active' 
                            ORDER BY next_payment_date ASC LIMIT 1
                        ");
                        $subStmt->execute([$client['id']]);
                        $subscription = $subStmt->fetch();
                        
                        // Insert conversation
                        $insertStmt = $pdo->prepare("
                            INSERT INTO email_conversations 
                            (client_id, subscription_id, subject, body, email_from, email_to, is_read, is_outgoing, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, 0, 0, NOW())
                        ");
                        $insertStmt->execute([
                            $client['id'],
                            $subscription['id'] ?? null,
                            $subject,
                            strip_tags($body),
                            $from,
                            getenv('IMAP_USER')
                        ]);
                        
                        $imported++;
                    }
                }
            }
        }
        
        imap_close($connection);
        
        ApiResponse::success([
            'message' => "Fetched {$imported} new emails",
            'imported' => $imported
        ]);
        
    } catch (Exception $e) {
        error_log('IMAP Error: ' . $e->getMessage());
        ApiResponse::error('Failed to fetch emails: ' . $e->getMessage(), 500);
    }
}

/**
 * Mark conversation as read
 */
function markAsRead(PDO $pdo, array $data): void {
    $id = $data['id'] ?? null;
    
    if (!$id) {
        ApiResponse::error('Conversation ID required', 400);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE email_conversations SET is_read = 1 WHERE id = ?");
        $stmt->execute([$id]);
        
        ApiResponse::success(['message' => 'Marked as read']);
    } catch (PDOException $e) {
        ApiResponse::serverError('Failed to mark as read');
    }
}

/**
 * Send reply to email
 */
function sendReply(PDO $pdo, array $data): void {
    $conversationId = $data['conversation_id'] ?? null;
    $body = $data['body'] ?? null;
    
    if (!$conversationId || !$body) {
        ApiResponse::error('Conversation ID and body required', 400);
        return;
    }
    
    try {
        // Get original conversation
        $stmt = $pdo->prepare("SELECT * FROM email_conversations WHERE id = ?");
        $stmt->execute([$conversationId]);
        $conversation = $stmt->fetch();
        
        if (!$conversation) {
            ApiResponse::error('Conversation not found', 404);
            return;
        }
        
        // Send email (reuse SMTP from billing)
        require_once 'billing.php';
        
        $smtpHost = getenv('SMTP_HOST');
        $smtpPort = (int)(getenv('SMTP_PORT') ?: 587);
        $smtpUser = getenv('SMTP_USER');
        $smtpPass = getenv('SMTP_PASS');
        $fromName = getenv('SMTP_FROM_NAME') ?: 'Payments Dashboard';
        $fromEmail = getenv('SMTP_FROM_EMAIL') ?: $smtpUser;
        
        global $phpmailer_available;
        
        if ($phpmailer_available) {
            $result = sendViaPHPMailer(
                $smtpHost, $smtpPort, $smtpUser, $smtpPass,
                $fromEmail, $fromName,
                $conversation['email_from'],
                'Re: ' . $conversation['subject'],
                nl2br(htmlspecialchars($body))
            );
        } else {
            $headers = "From: {$fromName} <{$fromEmail}>\r\n";
            $headers .= "Reply-To: {$fromEmail}\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            
            $sent = mail(
                $conversation['email_from'],
                'Re: ' . $conversation['subject'],
                nl2br(htmlspecialchars($body)),
                $headers
            );
            
            $result = ['success' => $sent];
        }
        
        if ($result['success']) {
            // Save reply to database
            $insertStmt = $pdo->prepare("
                INSERT INTO email_conversations 
                (client_id, subscription_id, subject, body, email_from, email_to, is_read, is_outgoing, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW())
            ");
            $insertStmt->execute([
                $conversation['client_id'],
                $conversation['subscription_id'],
                'Re: ' . $conversation['subject'],
                $body,
                $fromEmail,
                $conversation['email_from']
            ]);
            
            ApiResponse::success(['message' => 'Reply sent successfully']);
        } else {
            ApiResponse::error('Failed to send reply: ' . ($result['error'] ?? 'Unknown error'), 500);
        }
        
    } catch (Exception $e) {
        error_log('Reply Error: ' . $e->getMessage());
        ApiResponse::serverError('Failed to send reply');
    }
}

/**
 * Ensure conversations table exists
 */
function ensureConversationsTable(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS email_conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id INT NOT NULL,
            subscription_id INT NULL,
            subject VARCHAR(500) NOT NULL,
            body TEXT,
            email_from VARCHAR(255) NOT NULL,
            email_to VARCHAR(255) NOT NULL,
            is_read TINYINT(1) DEFAULT 0,
            is_outgoing TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_client (client_id),
            INDEX idx_subscription (subscription_id),
            INDEX idx_created (created_at),
            INDEX idx_is_read (is_read)
        )
    ");
}

/**
 * Get part of email (for multipart messages)
 */
function getPart($connection, $uid, $structure, $mimetype): ?string {
    if (!$structure->parts) return null;
    
    foreach ($structure->parts as $partNum => $part) {
        $partMimeType = strtolower($part->type) . '/' . strtolower($part->subtype);
        
        if ($partMimeType == strtolower($mimetype)) {
            return imap_fetchbody($connection, $uid, $partNum + 1, FT_UID);
        }
        
        if ($part->parts) {
            $result = getPart($connection, $uid, $part, $mimetype);
            if ($result) return $result;
        }
    }
    
    return null;
}

/**
 * Decode email body
 */
function decodeBody(string $body, int $encoding): string {
    switch ($encoding) {
        case 3: // BASE64
            return base64_decode($body);
        case 4: // QUOTED-PRINTABLE
            return quoted_printable_decode($body);
        default:
            return $body;
    }
}

/**
 * Decode MIME header
 */
function decodeMimeHeader(string $text): string {
    $decoded = '';
    $elements = imap_mime_header_decode($text);
    foreach ($elements as $element) {
        $decoded .= $element->text;
    }
    return $decoded;
}
