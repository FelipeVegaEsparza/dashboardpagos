<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $serviceId = $_GET['service_id'] ?? null;
        if ($serviceId) {
            $stmt = $pdo->prepare("SELECT * FROM products WHERE service_id = ?");
            $stmt->execute([$serviceId]);
        } else {
            $stmt = $pdo->query("SELECT * FROM products");
        }
        echo json_encode($stmt->fetchAll());
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("INSERT INTO products (service_id, name, price, billing_cycle) VALUES (?, ?, ?, ?)");
        $stmt->execute([$data['service_id'], $data['name'], $data['price'], $data['billing_cycle']]);
        echo json_encode(['id' => $pdo->lastInsertId(), 'message' => 'Product created']);
        break;
}
?>
