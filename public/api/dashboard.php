<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // 1. Total Clients
        $stmt = $pdo->query("SELECT COUNT(*) FROM clients");
        $totalClients = $stmt->fetchColumn();

        // 2. Active Subscriptions
        $stmt = $pdo->query("SELECT COUNT(*) FROM subscriptions");
        $activeSubscriptions = $stmt->fetchColumn();

        // 3. Estimated Monthly Revenue
        // This is a simplified calculation. Ideally, we'd normalize yearly plans (/12).
        // For now, we'll sum the price of all subscriptions.
        // Assuming 'price' in subscriptions table is the recurring amount.
        // If products have billing_cycle, we might want to adjust.
        // Let's do a smarter query joining products.
        
        $sqlRevenue = "
            SELECT SUM(
                CASE 
                    WHEN p.billing_cycle = 'yearly' THEN s.price / 12 
                    ELSE s.price 
                END
            ) 
            FROM subscriptions s
            JOIN products p ON s.product_id = p.id
        ";
        $stmt = $pdo->query($sqlRevenue);
        $monthlyRevenue = $stmt->fetchColumn() ?: 0;

        // 4. Upcoming Payments (Next 5)
        $sqlUpcoming = "
            SELECT s.id, c.name as client_name, s.price, s.next_payment_date, p.name as product_name
            FROM subscriptions s
            JOIN clients c ON s.client_id = c.id
            JOIN products p ON s.product_id = p.id
            ORDER BY s.next_payment_date ASC
            LIMIT 5
        ";
        $stmt = $pdo->query($sqlUpcoming);
        $upcomingPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'total_clients' => $totalClients,
            'active_subscriptions' => $activeSubscriptions,
            'monthly_revenue' => round($monthlyRevenue, 2),
            'upcoming_payments' => $upcomingPayments
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
