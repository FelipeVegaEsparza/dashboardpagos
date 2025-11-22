<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Handle File Upload
    $receiptUrl = null;
    if (isset($_FILES['receipt']) && $_FILES['receipt']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/receipts/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        $fileTmpPath = $_FILES['receipt']['tmp_name'];
        $fileName = $_FILES['receipt']['name'];
        $fileSize = $_FILES['receipt']['size'];
        $fileType = $_FILES['receipt']['type'];
        $fileNameCmps = explode(".", $fileName);
        $fileExtension = strtolower(end($fileNameCmps));

        $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
        $dest_path = $uploadDir . $newFileName;

        if(move_uploaded_file($fileTmpPath, $dest_path)) {
            $receiptUrl = '/uploads/receipts/' . $newFileName;
        }
    }

    // Handle JSON or FormData
    // If content-type is json, use php://input. If multipart, use $_POST
    $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    if (!isset($data['subscription_id']) || !isset($data['amount']) || !isset($data['date'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. Registrar el pago
        $stmt = $pdo->prepare("INSERT INTO payments (subscription_id, date, amount, status, receipt_url) VALUES (?, ?, ?, 'paid', ?)");
        $stmt->execute([$data['subscription_id'], $data['date'], $data['amount'], $receiptUrl]);
        $paymentId = $pdo->lastInsertId();

        // 2. Obtener información de la suscripción y el producto para calcular la próxima fecha
        $stmt = $pdo->prepare("
            SELECT s.next_payment_date, p.billing_cycle 
            FROM subscriptions s 
            JOIN products p ON s.product_id = p.id 
            WHERE s.id = ?
        ");
        $stmt->execute([$data['subscription_id']]);
        $info = $stmt->fetch();

        if ($info) {
            // Calcular nueva fecha de pago
            // Usamos la fecha de pago actual (next_payment_date) como base para mantener el ciclo
            // O usamos la fecha actual si ya pasó mucho tiempo? 
            // Lo estándar es sumar al next_payment_date original para no perder periodos, 
            // o sumar a la fecha de pago si se quiere reiniciar el ciclo.
            // Asumiremos que se suma al next_payment_date para mantener la coherencia del ciclo.
            
            $currentNextDate = new DateTime($info['next_payment_date']);
            
            if ($info['billing_cycle'] === 'monthly') {
                $currentNextDate->modify('+1 month');
            } else {
                $currentNextDate->modify('+1 year');
            }
            
            $newNextDate = $currentNextDate->format('Y-m-d');

            // 3. Actualizar la suscripción
            $stmt = $pdo->prepare("UPDATE subscriptions SET next_payment_date = ? WHERE id = ?");
            $stmt->execute([$newNextDate, $data['subscription_id']]);
        }

        $pdo->commit();
        echo json_encode(['id' => $paymentId, 'message' => 'Payment registered successfully', 'new_next_payment_date' => $newNextDate ?? null]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} elseif ($method === 'GET') {
    if (!isset($_GET['subscription_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing subscription_id']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE subscription_id = ? ORDER BY date DESC, id DESC");
    $stmt->execute([$_GET['subscription_id']]);
    echo json_encode($stmt->fetchAll());
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
