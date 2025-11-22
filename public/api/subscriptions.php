<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Calcular next_payment_date basado en el ciclo de facturación del producto
        // Primero obtenemos el producto para saber su ciclo
        $stmt = $pdo->prepare("SELECT billing_cycle FROM products WHERE id = ?");
        $stmt->execute([$data['product_id']]);
        $product = $stmt->fetch();
        
        $startDate = $data['start_date'];
        $nextPaymentDate = $startDate;
        
        if ($product) {
            $date = new DateTime($startDate);
            if ($product['billing_cycle'] === 'monthly') {
                $date->modify('+1 month');
            } else {
                $date->modify('+1 year');
            }
            $nextPaymentDate = $date->format('Y-m-d');
        }

        $stmt = $pdo->prepare("INSERT INTO subscriptions (client_id, product_id, start_date, next_payment_date, status) VALUES (?, ?, ?, ?, 'active')");
        $stmt->execute([$data['client_id'], $data['product_id'], $startDate, $nextPaymentDate]);
        
        echo json_encode(['id' => $pdo->lastInsertId(), 'message' => 'Subscription created']);
        break;

    case 'GET':
        // Obtener suscripciones
        $sql = "
            SELECT s.*, c.name as client_name, p.name as product_name, p.price, p.billing_cycle, serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
        ";
        
        if (isset($_GET['client_id'])) {
            $sql .= " WHERE s.client_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$_GET['client_id']]);
        } else {
            // Listar todas (ordenadas por fecha de creación descendente)
            $sql .= " ORDER BY s.id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
        }
        
        echo json_encode($stmt->fetchAll());
        break;
}
?>
