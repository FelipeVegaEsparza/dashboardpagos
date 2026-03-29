<?php
/**
 * Billing API Endpoint - Send reminder emails to clients
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Include PHPMailer if available
$phpmailer_available = false;
if (file_exists('/var/www/vendor/autoload.php')) {
    require_once '/var/www/vendor/autoload.php';
    $phpmailer_available = class_exists('PHPMailer\PHPMailer\PHPMailer');
}

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

    default:
        ApiResponse::error('Method not allowed', 405);
}

/**
 * Handle GET request - Get subscriptions needing billing attention
 */
function handleGet(PDO $pdo): void {
    $type = $_GET['type'] ?? 'all'; // all, overdue, due_soon, due_today
    
    try {
        $where = ["s.status = 'active'"];
        $params = [];
        
        $today = date('Y-m-d');
        
        switch ($type) {
            case 'overdue':
                $where[] = "s.next_payment_date < :today";
                $params[':today'] = $today;
                break;
                
            case 'due_today':
                $where[] = "s.next_payment_date = :today";
                $params[':today'] = $today;
                break;
                
            case 'due_soon':
                $where[] = "s.next_payment_date > :today AND s.next_payment_date <= :soon";
                $params[':today'] = $today;
                $params[':soon'] = date('Y-m-d', strtotime('+7 days'));
                break;
                
            case 'all':
            default:
                $where[] = "s.next_payment_date <= :soon";
                $params[':soon'] = date('Y-m-d', strtotime('+7 days'));
                break;
        }
        
        $whereClause = 'WHERE ' . implode(' AND ', $where);
        
        // Check if last_email_sent column exists
        $checkCol = $pdo->query("SHOW COLUMNS FROM subscriptions LIKE 'last_email_sent'");
        $hasLastEmailSent = $checkCol->fetch() !== false;
        
        $lastEmailField = $hasLastEmailSent ? 's.last_email_sent' : 'NULL as last_email_sent';
        
        $sql = "
            SELECT 
                s.id, s.client_id, s.product_id, s.project_name, s.start_date, 
                s.next_payment_date, s.status, {$lastEmailField},
                c.name as client_name, c.email as client_email, c.phone as client_phone,
                p.name as product_name, p.price, p.billing_cycle,
                serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
            $whereClause
            ORDER BY s.next_payment_date ASC, c.name ASC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $subscriptions = $stmt->fetchAll();
        
        // Categorize subscriptions
        $categorized = [
            'overdue' => [],
            'due_today' => [],
            'due_soon' => [],
            'total' => count($subscriptions)
        ];
        
        foreach ($subscriptions as $sub) {
            $paymentDate = strtotime($sub['next_payment_date']);
            $today_ts = strtotime($today);
            $diffDays = ceil(($paymentDate - $today_ts) / (60 * 60 * 24));
            
            $sub['days_until_due'] = $diffDays;
            
            if ($diffDays < 0) {
                $categorized['overdue'][] = $sub;
            } elseif ($diffDays === 0) {
                $categorized['due_today'][] = $sub;
            } else {
                $categorized['due_soon'][] = $sub;
            }
        }
        
        ApiResponse::success($categorized);
        
    } catch (PDOException $e) {
        error_log('Error fetching billing subscriptions: ' . $e->getMessage());
        ApiResponse::serverError('Failed to fetch subscriptions');
    }
}

/**
 * Handle POST request - Send reminder email
 */
function handlePost(PDO $pdo): void {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validation
    $validator = new InputValidator($data);
    $validator
        ->required('subscription_id', 'Subscription ID is required')
        ->numeric('subscription_id', 1, null, 'Invalid subscription ID');
    
    $validator->throwIfFailed();
    
    $subscriptionId = (int) $data['subscription_id'];
    $template = $data['template'] ?? 'reminder'; // reminder, overdue, final_notice
    $customMessage = $data['custom_message'] ?? null;
    
    try {
        // Check if last_email_sent column exists
        $checkCol = $pdo->query("SHOW COLUMNS FROM subscriptions LIKE 'last_email_sent'");
        $hasLastEmailSent = $checkCol->fetch() !== false;
        
        $lastEmailField = $hasLastEmailSent ? 's.last_email_sent' : 'NULL as last_email_sent';
        
        // Get subscription details with last email sent
        $stmt = $pdo->prepare("
            SELECT 
                s.id, s.next_payment_date, {$lastEmailField},
                c.name as client_name, c.email as client_email,
                p.name as product_name, p.price,
                serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
            WHERE s.id = ? AND s.status = 'active'
        ");
        $stmt->execute([$subscriptionId]);
        $subscription = $stmt->fetch();
        
        if (!$subscription) {
            ApiResponse::error('Subscription not found or not active', 404);
            return;
        }
        
        if (empty($subscription['client_email'])) {
            ApiResponse::error('Client does not have an email address', 400);
            return;
        }
        
        // Check if email was already sent today
        if ($subscription['last_email_sent']) {
            $lastSent = strtotime($subscription['last_email_sent']);
            $today = strtotime(date('Y-m-d'));
            
            if ($lastSent >= $today) {
                ApiResponse::error('Ya se envió un email a este cliente hoy. Espere hasta mañana para enviar otro.', 429);
                return;
            }
        }
        
        // Send email
        $result = sendBillingEmail($subscription, $template, $customMessage);
        
        if ($result['success']) {
            // Update last_email_sent timestamp (if column exists)
            try {
                $updateStmt = $pdo->prepare("UPDATE subscriptions SET last_email_sent = NOW() WHERE id = ?");
                $updateStmt->execute([$subscriptionId]);
            } catch (PDOException $e) {
                // Column might not exist yet, ignore error
                error_log('Could not update last_email_sent: ' . $e->getMessage());
            }
            
            // Log the email sent
            logEmailSent($pdo, $subscriptionId, $subscription['client_email'], $template);
            
            ApiResponse::success([
                'message' => 'Email sent successfully',
                'to' => $subscription['client_email'],
                'template' => $template
            ]);
        } else {
            ApiResponse::error('Failed to send email: ' . $result['error'], 500);
        }
        
    } catch (PDOException $e) {
        error_log('Error sending billing email: ' . $e->getMessage());
        ApiResponse::serverError('Failed to send email');
    }
}

/**
 * Send billing email using SMTP
 */
function sendBillingEmail(array $subscription, string $template, ?string $customMessage): array {
    // Fallback configuration for production (remove after fixing Dokploy env vars)
    $smtpHost = env('SMTP_HOST') ?: 'mail.somossimple.cl';
    $smtpPort = (int)(env('SMTP_PORT') ?: 465);
    $smtpUser = env('SMTP_USER') ?: 'pagos@somossimple.cl';
    $smtpPass = env('SMTP_PASS') ?: 'simple2026@';
    $fromName = env('SMTP_FROM_NAME') ?: 'SomosSimple.cl';
    $fromEmail = env('SMTP_FROM_EMAIL') ?: 'pagos@somossimple.cl';
    
    if (!$smtpUser || !$smtpPass) {
        return ['success' => false, 'error' => 'SMTP not configured'];
    }
    
    $to = $subscription['client_email'];
    $clientName = $subscription['client_name'];
    $serviceName = $subscription['service_name'];
    $productName = $subscription['product_name'];
    $amount = number_format($subscription['price'], 2);
    $dueDate = date('d/m/Y', strtotime($subscription['next_payment_date']));
    
    // Calculate days until due
    $today = strtotime(date('Y-m-d'));
    $due = strtotime($subscription['next_payment_date']);
    $daysDiff = ceil(($due - $today) / (60 * 60 * 24));
    
    // Get email content based on template
    $emailContent = getEmailTemplate($template, [
        'client_name' => $clientName,
        'service_name' => $serviceName,
        'product_name' => $productName,
        'amount' => $amount,
        'due_date' => $dueDate,
        'days_until_due' => $daysDiff,
        'custom_message' => $customMessage
    ]);
    
    $subject = $emailContent['subject'];
    $body = $emailContent['body'];
    
    // Use PHPMailer if available
    global $phpmailer_available;
    if ($phpmailer_available) {
        return sendViaPHPMailer($smtpHost, $smtpPort, $smtpUser, $smtpPass, $fromEmail, $fromName, $to, $subject, $body);
    }
    
    // Create email headers
    $headers = "From: {$fromName} <{$fromEmail}>\r\n";
    $headers .= "Reply-To: {$fromEmail}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    // Try to send via SMTP if available, otherwise use mail()
    if (function_exists('fsockopen') && $smtpHost && $smtpPort) {
        $result = sendViaSMTP($smtpHost, $smtpPort, $smtpUser, $smtpPass, $fromEmail, $fromName, $to, $subject, $body);
        return $result;
    }
    
    // Fallback to mail()
    $sent = mail($to, $subject, $body, $headers);
    
    if ($sent) {
        return ['success' => true];
    } else {
        return ['success' => false, 'error' => 'mail() function failed'];
    }
}

/**
 * Send email via PHPMailer
 */
function sendViaPHPMailer($host, $port, $username, $password, $fromEmail, $fromName, $to, $subject, $body): array {
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        
        // Server settings
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $username;
        $mail->Password = $password;
        
        // Use SSL for port 465, STARTTLS for 587
        if ($port == 465) {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->Port = $port;
        $mail->CharSet = 'UTF-8';
        
        // Recipients
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($to);
        
        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;
        
        $mail->send();
        return ['success' => true];
    } catch (Exception $e) {
        error_log('PHPMailer Error: ' . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Send email via SMTP (manual implementation as fallback)
 */
function sendViaSMTP($host, $port, $username, $password, $fromEmail, $fromName, $to, $subject, $body): array {
    $timeout = 10;
    
    // Connect to SMTP server
    $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);
    
    if (!$socket) {
        return ['success' => false, 'error' => "Connection failed: $errstr ($errno)"];
    }
    
    // Read server greeting
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '220') {
        fclose($socket);
        return ['success' => false, 'error' => 'Server did not respond correctly'];
    }
    
    // EHLO
    fputs($socket, "EHLO " . $_SERVER['HTTP_HOST'] . "\r\n");
    while ($line = fgets($socket, 515)) {
        if (substr($line, 3, 1) == ' ') break;
    }
    
    // STARTTLS for port 587
    if ($port == 587) {
        fputs($socket, "STARTTLS\r\n");
        $response = fgets($socket, 515);
        if (substr($response, 0, 3) != '220') {
            fclose($socket);
            return ['success' => false, 'error' => 'STARTTLS failed'];
        }
        
        // Enable TLS
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            return ['success' => false, 'error' => 'TLS negotiation failed'];
        }
        
        // EHLO again after TLS
        fputs($socket, "EHLO " . $_SERVER['HTTP_HOST'] . "\r\n");
        while ($line = fgets($socket, 515)) {
            if (substr($line, 3, 1) == ' ') break;
        }
    }
    
    // AUTH LOGIN
    fputs($socket, "AUTH LOGIN\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '334') {
        fclose($socket);
        return ['success' => false, 'error' => 'AUTH LOGIN failed'];
    }
    
    // Username
    fputs($socket, base64_encode($username) . "\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '334') {
        fclose($socket);
        return ['success' => false, 'error' => 'Username rejected'];
    }
    
    // Password
    fputs($socket, base64_encode($password) . "\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '235') {
        fclose($socket);
        return ['success' => false, 'error' => 'Authentication failed - check SMTP credentials'];
    }
    
    // MAIL FROM
    fputs($socket, "MAIL FROM:<{$fromEmail}>\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '250') {
        fclose($socket);
        return ['success' => false, 'error' => 'MAIL FROM failed'];
    }
    
    // RCPT TO
    fputs($socket, "RCPT TO:<{$to}>\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '250') {
        fclose($socket);
        return ['success' => false, 'error' => 'RCPT TO failed'];
    }
    
    // DATA
    fputs($socket, "DATA\r\n");
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '354') {
        fclose($socket);
        return ['success' => false, 'error' => 'DATA command failed'];
    }
    
    // Message
    $message = "To: {$to}\r\n";
    $message .= "From: {$fromName} <{$fromEmail}>\r\n";
    $message .= "Subject: {$subject}\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "\r\n";
    $message .= $body;
    $message .= "\r\n.\r\n";
    
    fputs($socket, $message);
    $response = fgets($socket, 515);
    if (substr($response, 0, 3) != '250') {
        fclose($socket);
        return ['success' => false, 'error' => 'Message delivery failed'];
    }
    
    // QUIT
    fputs($socket, "QUIT\r\n");
    fclose($socket);
    
    return ['success' => true];
}

/**
 * Get email template
 */
function getEmailTemplate(string $template, array $vars): array {
    $clientName = $vars['client_name'];
    $serviceName = $vars['service_name'];
    $productName = $vars['product_name'];
    $amount = $vars['amount'];
    $dueDate = $vars['due_date'];
    $daysUntilDue = $vars['days_until_due'];
    $customMessage = $vars['custom_message'];
    
    $companyName = getenv('SMTP_FROM_NAME') ?: 'Payments Dashboard';
    
    switch ($template) {
        case 'overdue':
            $subject = "Recordatorio de pago vencido - {$serviceName}";
            $body = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .highlight { background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>⚠️ Pago Vencido</h2>
        </div>
        <div class="content">
            <p>Estimado/a <strong>{$clientName}</strong>,</p>
            
            <div class="highlight">
                <p><strong>Su pago está vencido desde el {$dueDate}</strong></p>
                <p>Por favor, regularice su situación lo antes posible para evitar la suspensión de su servicio.</p>
            </div>
            
            <div class="details">
                <h3>Detalles de su suscripción:</h3>
                <p><strong>Servicio:</strong> {$serviceName}</p>
                <p><strong>Plan:</strong> {$productName}</p>
                <p><strong>Monto:</strong> \${$amount}</p>
                <p><strong>Fecha de vencimiento:</strong> {$dueDate}</p>
            </div>
            
            <p>Si ya realizó el pago, por favor ignore este mensaje o envíenos el comprobante.</p>
            
            <p>Para cualquier consulta, no dude en contactarnos.</p>
            
            <p>Saludos cordiales,<br>
            <strong>{$companyName}</strong></p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático de {$companyName}</p>
        </div>
    </div>
</body>
</html>
HTML;
            break;
            
        case 'final_notice':
            $subject = "AVISO IMPORTANTE: Pago vencido - {$serviceName}";
            $body = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7f1d1d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert { background: #fef2f2; border: 2px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>⚠️ AVISO FINAL</h2>
        </div>
        <div class="content">
            <p>Estimado/a <strong>{$clientName}</strong>,</p>
            
            <div class="alert">
                <p><strong>ATENCIÓN:</strong> Su pago está significativamente vencido (desde {$dueDate}).</p>
                <p><strong>Su servicio podría ser suspendido si no regulariza su pago inmediatamente.</strong></p>
            </div>
            
            <div class="details">
                <h3>Detalles:</h3>
                <p><strong>Servicio:</strong> {$serviceName} - {$productName}</p>
                <p><strong>Monto adeudado:</strong> \${$amount}</p>
                <p><strong>Vencido desde:</strong> {$dueDate}</p>
            </div>
            
            <p><strong>Por favor, realice el pago lo antes posible.</strong></p>
            
            <p>{$companyName}</p>
        </div>
    </div>
</body>
</html>
HTML;
            break;
            
        case 'reminder':
        default:
            $subject = "Recordatorio de pago próximo - {$serviceName}";
            $dueText = $daysUntilDue === 0 
                ? "<strong>¡Su pago vence HOY!</strong>" 
                : "Su pago vence en {$daysUntilDue} días ({$dueDate})";
                
            $body = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .highlight { background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📅 Recordatorio de Pago</h2>
        </div>
        <div class="content">
            <p>Estimado/a <strong>{$clientName}</strong>,</p>
            
            <p>Le escribimos para recordarle que tiene un pago próximo a vencer:</p>
            
            <div class="highlight">
                <p>{$dueText}</p>
            </div>
            
            <div class="details">
                <h3>Detalles de su suscripción:</h3>
                <p><strong>Servicio:</strong> {$serviceName}</p>
                <p><strong>Plan:</strong> {$productName}</p>
                <p><strong>Monto:</strong> \${$amount}</p>
                <p><strong>Fecha de vencimiento:</strong> {$dueDate}</p>
            </div>
            
            <p>Por favor, asegúrese de realizar el pago a tiempo para evitar interrupciones en su servicio.</p>
            
            <p>Para cualquier consulta, no dude en contactarnos.</p>
            
            <p>Saludos cordiales,<br>
            <strong>{$companyName}</strong></p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático de {$companyName}</p>
        </div>
    </div>
</body>
</html>
HTML;
            break;
    }
    
    // Add custom message if provided
    if ($customMessage) {
        $body = str_replace(
            '</div>\n            <p>Saludos cordiales,',
            '</div>\n            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">\n                <p><strong>Nota adicional:</strong></p>\n                <p>' . nl2br(htmlspecialchars($customMessage)) . '</p>\n            </div>\n            <p>Saludos cordiales,',
            $body
        );
    }
    
    return ['subject' => $subject, 'body' => $body];
}

/**
 * Log email sent (optional)
 */
function logEmailSent(PDO $pdo, int $subscriptionId, string $email, string $template): void {
    try {
        // Check if email_logs table exists, if not create it
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS email_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subscription_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                template VARCHAR(50) NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_subscription (subscription_id),
                INDEX idx_sent_at (sent_at)
            )
        ");
        
        $stmt = $pdo->prepare("
            INSERT INTO email_logs (subscription_id, email, template) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$subscriptionId, $email, $template]);
    } catch (PDOException $e) {
        // Silent fail - don't break the email sending
        error_log('Failed to log email: ' . $e->getMessage());
    }
}
