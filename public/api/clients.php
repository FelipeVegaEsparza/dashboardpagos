<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("SELECT * FROM clients ORDER BY created_at DESC");
        echo json_encode($stmt->fetchAll());
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)");
        $stmt->execute([$data['name'], $data['email'], $data['phone']]);
        echo json_encode(['id' => $pdo->lastInsertId(), 'message' => 'Client created']);
        break;

    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ?");
        $stmt->execute([$data['name'], $data['email'], $data['phone'], $data['id']]);
        echo json_encode(['message' => 'Client updated']);
        break;

    case 'DELETE':
        $id = $_GET['id'];
        $stmt = $pdo->prepare("DELETE FROM clients WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Client deleted']);
        break;
}
?>
