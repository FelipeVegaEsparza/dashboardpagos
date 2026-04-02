<?php
/**
 * Debug endpoint para encontrar suscripciones ocultas
 * ELIMINAR DESPUÉS DE USAR
 */

require_once 'config.php';
require_once 'auth_middleware.php';

AuthMiddleware::requireAuth();

header('Content-Type: application/json');

try {
    // Obtener parámetros
    $clientId = $_GET['client_id'] ?? null;
    $productId = $_GET['product_id'] ?? null;
    
    if ($clientId && $productId) {
        // Buscar suscripciones específicas (todas, sin importar status)
        $stmt = $pdo->prepare("
            SELECT 
                s.id, s.client_id, s.product_id, s.project_name, 
                s.start_date, s.next_payment_date, s.status, s.created_at,
                c.name as client_name,
                p.name as product_name,
                serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
            WHERE s.client_id = ? AND s.product_id = ?
            ORDER BY s.created_at DESC
        ");
        $stmt->execute([$clientId, $productId]);
        $subscriptions = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'message' => 'Suscripciones encontradas para cliente ' . $clientId . ' y producto ' . $productId,
            'count' => count($subscriptions),
            'subscriptions' => $subscriptions
        ]);
    } else {
        // Listar TODAS las suscripciones agrupadas por status
        $stmt = $pdo->query("
            SELECT 
                s.status,
                COUNT(*) as count,
                GROUP_CONCAT(
                    CONCAT(c.name, ' (', p.name, ')') 
                    SEPARATOR ', '
                ) as subscriptions_list
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            GROUP BY s.status
        ");
        $statusSummary = $stmt->fetchAll();
        
        // Obtener todas las suscripciones no-activas
        $stmt = $pdo->query("
            SELECT 
                s.id, s.client_id, s.product_id, s.project_name, 
                s.start_date, s.next_payment_date, s.status, s.created_at,
                c.name as client_name,
                p.name as product_name,
                serv.name as service_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            JOIN services serv ON p.service_id = serv.id
            WHERE s.status != 'active'
            ORDER BY s.created_at DESC
        ");
        $nonActiveSubscriptions = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'message' => 'Resumen de todas las suscripciones',
            'status_summary' => $statusSummary,
            'non_active_subscriptions' => $nonActiveSubscriptions,
            'total_non_active' => count($nonActiveSubscriptions)
        ]);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}
