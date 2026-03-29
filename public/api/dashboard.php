<?php
/**
 * Dashboard API Endpoint - Protected with Authentication
 * Optimized queries with caching potential
 */

require_once 'config.php';
require_once 'auth_middleware.php';

// Require authentication
AuthMiddleware::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
    exit;
}

try {
    // 1. Total Clients
    $stmt = $pdo->query("SELECT COUNT(*) FROM clients");
    $totalClients = (int) $stmt->fetchColumn();

    // 2. Active Subscriptions
    $stmt = $pdo->query("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'");
    $activeSubscriptions = (int) $stmt->fetchColumn();
    
    // Total subscriptions (all statuses)
    $stmt = $pdo->query("SELECT COUNT(*) FROM subscriptions");
    $totalSubscriptions = (int) $stmt->fetchColumn();

    // 3. Estimated Monthly Revenue
    // Optimized: Normalize yearly to monthly for accurate projection
    $sqlRevenue = "
        SELECT SUM(
            CASE 
                WHEN p.billing_cycle = 'yearly' THEN p.price / 12 
                ELSE p.price 
            END
        ) as monthly_revenue,
        SUM(
            CASE 
                WHEN p.billing_cycle = 'yearly' THEN p.price
                ELSE p.price * 12
            END
        ) as yearly_revenue
        FROM subscriptions s
        JOIN products p ON s.product_id = p.id
        WHERE s.status = 'active'
    ";
    $stmt = $pdo->query($sqlRevenue);
    $revenue = $stmt->fetch();
    $monthlyRevenue = round((float) ($revenue['monthly_revenue'] ?? 0), 2);
    $yearlyRevenue = round((float) ($revenue['yearly_revenue'] ?? 0), 2);

    // 4. Upcoming Payments (Next 10)
    $sqlUpcoming = "
        SELECT 
            s.id, 
            c.name as client_name, 
            p.price, 
            s.next_payment_date, 
            s.project_name,
            p.name as product_name,
            p.billing_cycle,
            serv.name as service_name,
            DATEDIFF(s.next_payment_date, CURDATE()) as days_until
        FROM subscriptions s
        JOIN clients c ON s.client_id = c.id
        JOIN products p ON s.product_id = p.id
        JOIN services serv ON p.service_id = serv.id
        WHERE s.status = 'active'
        ORDER BY s.next_payment_date ASC
        LIMIT 10
    ";
    $stmt = $pdo->query($sqlUpcoming);
    $upcomingPayments = $stmt->fetchAll();

    // 5. Payment statistics
    $sqlStats = "
        SELECT 
            COUNT(*) as total_payments,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
            SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed
        FROM payments
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    ";
    $stmt = $pdo->query($sqlStats);
    $paymentStats = $stmt->fetch();

    // 6. Overdue subscriptions count
    $sqlOverdue = "
        SELECT COUNT(*) 
        FROM subscriptions 
        WHERE status = 'active' AND next_payment_date < CURDATE()
    ";
    $stmt = $pdo->query($sqlOverdue);
    $overdueCount = (int) $stmt->fetchColumn();

    // 7. Recent activity (last 5 payments)
    $sqlRecent = "
        SELECT 
            p.id,
            p.date,
            p.amount,
            c.name as client_name,
            prod.name as product_name
        FROM payments p
        JOIN subscriptions s ON p.subscription_id = s.id
        JOIN clients c ON s.client_id = c.id
        JOIN products prod ON s.product_id = prod.id
        ORDER BY p.date DESC, p.id DESC
        LIMIT 5
    ";
    $stmt = $pdo->query($sqlRecent);
    $recentPayments = $stmt->fetchAll();

    ApiResponse::success([
        'stats' => [
            'total_clients' => $totalClients,
            'total_subscriptions' => $totalSubscriptions,
            'active_subscriptions' => $activeSubscriptions,
            'cancelled_subscriptions' => $totalSubscriptions - $activeSubscriptions,
            'monthly_revenue' => $monthlyRevenue,
            'yearly_revenue' => $yearlyRevenue,
            'overdue_count' => $overdueCount
        ],
        'payments' => [
            'last_30_days' => [
                'total' => (int) ($paymentStats['total_payments'] ?? 0),
                'paid' => round((float) ($paymentStats['total_paid'] ?? 0), 2),
                'pending' => round((float) ($paymentStats['total_pending'] ?? 0), 2),
                'failed' => round((float) ($paymentStats['total_failed'] ?? 0), 2)
            ],
            'recent' => $recentPayments
        ],
        'upcoming_payments' => $upcomingPayments
    ]);

} catch (PDOException $e) {
    error_log('Dashboard error: ' . $e->getMessage());
    ApiResponse::serverError('Failed to fetch dashboard data');
}
