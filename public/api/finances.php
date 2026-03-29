<?php
/**
 * Finances API Endpoint - Revenue reports and projections
 * Protected with Authentication
 */

require_once 'config.php';
require_once 'auth_middleware.php';

AuthMiddleware::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
    exit;
}

try {
    // 1. General summary
    $sqlSummary = "
        SELECT 
            SUM(CASE WHEN p.billing_cycle = 'yearly' THEN p.price / 12 ELSE p.price END) as mrr,
            SUM(CASE WHEN p.billing_cycle = 'yearly' THEN p.price ELSE p.price * 12 END) as arr,
            COUNT(*) as active_subscriptions
        FROM subscriptions s
        JOIN products p ON s.product_id = p.id
        WHERE s.status = 'active'
    ";
    $stmt = $pdo->query($sqlSummary);
    $summary = $stmt->fetch();

    $mrr = round((float) ($summary['mrr'] ?? 0), 2);
    $arr = round((float) ($summary['arr'] ?? 0), 2);
    $activeSubscriptions = (int) ($summary['active_subscriptions'] ?? 0);

    // 2. Total collected, pending, failed (all time)
    $sqlTotals = "
        SELECT 
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
            SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as payments_paid,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as payments_pending,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as payments_failed
        FROM payments
    ";
    $stmt = $pdo->query($sqlTotals);
    $totals = $stmt->fetch();

    // 3. Monthly revenue (last 12 months) - real payments
    $sqlMonthly = "
        SELECT 
            DATE_FORMAT(date, '%Y-%m') as month,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed,
            COUNT(*) as total_payments
        FROM payments
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(date, '%Y-%m')
        ORDER BY month ASC
    ";
    $stmt = $pdo->query($sqlMonthly);
    $monthlyData = $stmt->fetchAll();

    // Fill missing months with zeros
    $monthlyRevenue = [];
    for ($i = 11; $i >= 0; $i--) {
        $month = date('Y-m', strtotime("-$i months"));
        $monthlyRevenue[$month] = [
            'month' => $month,
            'month_name' => date('M Y', strtotime("-$i months")),
            'collected' => 0,
            'pending' => 0,
            'failed' => 0,
            'total_payments' => 0
        ];
    }
    foreach ($monthlyData as $row) {
        if (isset($monthlyRevenue[$row['month']])) {
            $monthlyRevenue[$row['month']]['collected'] = round((float) $row['collected'], 2);
            $monthlyRevenue[$row['month']]['pending'] = round((float) $row['pending'], 2);
            $monthlyRevenue[$row['month']]['failed'] = round((float) $row['failed'], 2);
            $monthlyRevenue[$row['month']]['total_payments'] = (int) $row['total_payments'];
        }
    }
    $monthlyRevenue = array_values($monthlyRevenue);

    // 4. Revenue by service
    $sqlByService = "
        SELECT 
            serv.name as service_name,
            SUM(CASE WHEN p.billing_cycle = 'yearly' THEN p.price / 12 ELSE p.price END) as monthly_revenue,
            COUNT(*) as subscriptions
        FROM subscriptions s
        JOIN products p ON s.product_id = p.id
        JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
        GROUP BY serv.id, serv.name
        ORDER BY monthly_revenue DESC
    ";
    $stmt = $pdo->query($sqlByService);
    $byService = $stmt->fetchAll();
    foreach ($byService as &$row) {
        $row['monthly_revenue'] = round((float) $row['monthly_revenue'], 2);
        $row['subscriptions'] = (int) $row['subscriptions'];
    }

    // 5. Top clients by revenue (active subscriptions)
    $sqlTopClients = "
        SELECT 
            c.name as client_name,
            SUM(CASE WHEN p.billing_cycle = 'yearly' THEN p.price / 12 ELSE p.price END) as monthly_revenue,
            COUNT(*) as subscriptions
        FROM subscriptions s
        JOIN products p ON s.product_id = p.id
        JOIN clients c ON s.client_id = c.id
        WHERE s.status = 'active'
        GROUP BY c.id, c.name
        ORDER BY monthly_revenue DESC
        LIMIT 10
    ";
    $stmt = $pdo->query($sqlTopClients);
    $topClients = $stmt->fetchAll();
    foreach ($topClients as &$row) {
        $row['monthly_revenue'] = round((float) $row['monthly_revenue'], 2);
        $row['subscriptions'] = (int) $row['subscriptions'];
    }

    // 6. Projection next 12 months (based on active subscriptions + historical growth)
    // Simple projection: assume MRR stays constant (can be enhanced later)
    $projections = [];
    for ($i = 1; $i <= 12; $i++) {
        $month = date('Y-m', strtotime("+$i months"));
        $projections[] = [
            'month' => $month,
            'month_name' => date('M Y', strtotime("+$i months")),
            'projected_mrr' => $mrr,
            'projected_arr' => $mrr * $i // cumulative? no, just monthly projection
        ];
    }

    // 7. Recent payments (last 10)
    $sqlRecent = "
        SELECT 
            p.id,
            p.date,
            p.amount,
            p.status,
            c.name as client_name,
            prod.name as product_name,
            serv.name as service_name
        FROM payments p
        JOIN subscriptions s ON p.subscription_id = s.id
        JOIN clients c ON s.client_id = c.id
        JOIN products prod ON s.product_id = prod.id
        JOIN services serv ON prod.service_id = serv.id
        ORDER BY p.date DESC, p.id DESC
        LIMIT 10
    ";
    $stmt = $pdo->query($sqlRecent);
    $recentPayments = $stmt->fetchAll();

    ApiResponse::success([
        'summary' => [
            'mrr' => $mrr,
            'arr' => $arr,
            'active_subscriptions' => $activeSubscriptions,
            'total_collected' => round((float) ($totals['total_collected'] ?? 0), 2),
            'total_pending' => round((float) ($totals['total_pending'] ?? 0), 2),
            'total_failed' => round((float) ($totals['total_failed'] ?? 0), 2),
            'payments_paid' => (int) ($totals['payments_paid'] ?? 0),
            'payments_pending' => (int) ($totals['payments_pending'] ?? 0),
            'payments_failed' => (int) ($totals['payments_failed'] ?? 0),
        ],
        'monthly_revenue' => $monthlyRevenue,
        'by_service' => $byService,
        'top_clients' => $topClients,
        'projections' => $projections,
        'recent_payments' => $recentPayments
    ]);

} catch (PDOException $e) {
    error_log('Finances error: ' . $e->getMessage());
    ApiResponse::serverError('Failed to fetch finances data');
}
