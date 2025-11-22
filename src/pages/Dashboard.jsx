import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Users, Playlist, CurrencyDollar, TrendUp, Warning, CheckCircle } from 'phosphor-react';

const Dashboard = () => {
    const [data, setData] = useState({
        total_clients: 0,
        active_subscriptions: 0,
        monthly_revenue: 0,
        upcoming_payments: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await api.get('/dashboard.php');
                setData(result);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getPaymentStatus = (dateString) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const paymentDate = new Date(dateString);
        paymentDate.setHours(0, 0, 0, 0);

        const diffTime = paymentDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)} días`, color: '#ef4444' };
        if (diffDays === 0) return { label: 'Vence hoy', color: '#eab308' };
        if (diffDays <= 7) return { label: `Vence en ${diffDays} días`, color: '#eab308' };
        return { label: 'Al día', color: '#22c55e' };
    };

    if (loading) return <div className="p-8">Cargando...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                        <Users size={32} weight="duotone" />
                    </div>
                    <div>
                        <p className="text-sm text-muted" style={{ margin: 0, color: 'var(--text-muted)' }}>Clientes Totales</p>
                        <h2 className="text-2xl font-bold" style={{ margin: 0 }}>{data.total_clients}</h2>
                    </div>
                </Card>

                <Card className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
                        <Playlist size={32} weight="duotone" />
                    </div>
                    <div>
                        <p className="text-sm text-muted" style={{ margin: 0, color: 'var(--text-muted)' }}>Suscripciones Activas</p>
                        <h2 className="text-2xl font-bold" style={{ margin: 0 }}>{data.active_subscriptions}</h2>
                    </div>
                </Card>

                <Card className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                        <CurrencyDollar size={32} weight="duotone" />
                    </div>
                    <div>
                        <p className="text-sm text-muted" style={{ margin: 0, color: 'var(--text-muted)' }}>Ingresos Mensuales (Est.)</p>
                        <h2 className="text-2xl font-bold" style={{ margin: 0 }}>{formatCurrency(data.monthly_revenue)}</h2>
                    </div>
                </Card>
            </div>

            <h2 className="text-xl font-semibold mb-4">Próximos Pagos</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
                {data.upcoming_payments.length > 0 ? (
                    data.upcoming_payments.map((payment) => {
                        const status = getPaymentStatus(payment.next_payment_date);
                        return (
                            <Card key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 className="font-semibold m-0">{payment.client_name}</h3>
                                    <p className="text-sm text-muted" style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)' }}>
                                        {payment.product_name}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p className="font-bold m-0">{formatCurrency(payment.price)}</p>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: status.color,
                                        display: 'block',
                                        marginTop: '0.25rem'
                                    }}>
                                        {status.label} ({payment.next_payment_date})
                                    </span>
                                </div>
                            </Card>
                        );
                    })
                ) : (
                    <p className="text-muted">No hay pagos próximos registrados.</p>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
