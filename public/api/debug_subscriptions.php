<?php
/**
 * DIAGNÓSTICO COMPLETO DE SUSCRIPCIONES
 * Encuentra por qué una suscripción no se muestra
 * ELIMINAR DESPUÉS DE USAR
 */

require_once 'config.php';
require_once 'auth_middleware.php';

AuthMiddleware::requireAuth();

header('Content-Type: application/json');

try {
    // 1. Contar suscripciones activas en la BD
    $stmt = $pdo->query("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'");
    $totalActive = $stmt->fetchColumn();
    
    // 2. Buscar suscripciones con referencias rotas (INNER JOIN)
    $stmt = $pdo->query("
        SELECT COUNT(*) 
        FROM subscriptions s
        INNER JOIN clients c ON s.client_id = c.id
        INNER JOIN products p ON s.product_id = p.id
        INNER JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
    ");
    $activeWithValidRefs = $stmt->fetchColumn();
    
    // 3. Encontrar las suscripciones con referencias rotas
    $stmt = $pdo->query("
        SELECT 
            s.id,
            s.client_id,
            s.product_id,
            s.status,
            s.project_name,
            s.next_payment_date,
            CASE WHEN c.id IS NULL THEN '❌ CLIENTE ELIMINADO' ELSE c.name END as client_name,
            CASE WHEN p.id IS NULL THEN '❌ PRODUCTO ELIMINADO' ELSE p.name END as product_name,
            CASE WHEN serv.id IS NULL THEN '❌ SERVICIO ELIMINADO' ELSE serv.name END as service_name,
            CASE 
                WHEN c.id IS NULL THEN 'broken_client'
                WHEN p.id IS NULL THEN 'broken_product'
                WHEN serv.id IS NULL THEN 'broken_service'
                ELSE 'ok'
            END as problem
        FROM subscriptions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
            AND (c.id IS NULL OR p.id IS NULL OR serv.id IS NULL)
    ");
    $brokenSubscriptions = $stmt->fetchAll();
    
    // 4. Listar TODAS las suscripciones activas con LEFT JOIN
    $stmt = $pdo->query("
        SELECT 
            s.id,
            s.client_id,
            s.product_id,
            s.status,
            s.project_name,
            s.start_date,
            s.next_payment_date,
            c.name as client_name,
            p.name as product_name,
            p.price,
            p.billing_cycle,
            serv.name as service_name
        FROM subscriptions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
        ORDER BY s.id DESC
    ");
    $allActiveSubscriptions = $stmt->fetchAll();
    
    // 5. Estadísticas
    $stmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN c.name IS NOT NULL THEN 1 END) as with_client,
            COUNT(CASE WHEN p.name IS NOT NULL THEN 1 END) as with_product,
            COUNT(CASE WHEN serv.name IS NOT NULL THEN 1 END) as with_service
        FROM subscriptions s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
    ");
    $stats = $stmt->fetch();
    
    $problemDetected = count($brokenSubscriptions) > 0;
    
    echo json_encode([
        'success' => true,
        'diagnosis' => [
            'total_active_in_db' => (int)$totalActive,
            'active_with_valid_refs' => (int)$activeWithValidRefs,
            'broken_subscriptions_count' => count($brokenSubscriptions),
            'problem_detected' => $problemDetected,
            'missing_subscriptions' => (int)$totalActive - (int)$activeWithValidRefs,
            'stats' => $stats
        ],
        'broken_subscriptions' => $brokenSubscriptions,
        'all_active_subscriptions' => $allActiveSubscriptions,
        'recommendation' => $problemDetected
            ? '⚠️ PROBLEMA ENCONTRADO: Hay ' . count($brokenSubscriptions) . ' suscripción(es) con referencias rotas (cliente/producto/servicio eliminado). Solución: Cambiar JOIN a LEFT JOIN en subscriptions.php o reparar las referencias en la BD.'
            : '✅ Todas las suscripciones tienen referencias válidas. El problema puede ser de paginación o filtros en el frontend.'
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}
