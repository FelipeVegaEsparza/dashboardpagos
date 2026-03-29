import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { TrendUp, CurrencyDollar, Wallet, Warning, CheckCircle, Clock, ChartBar, Users, Stack } from 'phosphor-react';

const Finances = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchFinances();
    }, []);

    const fetchFinances = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getFinances();
            setData(response.data || response);
        } catch (error) {
            console.error('Error fetching finances:', error);
            setError(error.message || 'Error al cargar datos financieros');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ color: 'var(--text-muted)' }}>Cargando finanzas...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1rem' }}>
                <div style={{ color: '#ef4444' }}>{error}</div>
                <Button onClick={fetchFinances}>Reintentar</Button>
            </div>
        );
    }

    const { summary, monthly_revenue, by_service, top_clients, projections, recent_payments } = data;

    const maxMonthly = Math.max(...monthly_revenue.map(m => m.collected + m.pending + m.failed), 1);
    const maxProjection = Math.max(...projections.map(p => p.projected_mrr), 1);

    const successRate = summary.payments_paid + summary.payments_pending + summary.payments_failed > 0
        ? Math.round((summary.payments_paid / (summary.payments_paid + summary.payments_pending + summary.payments_failed)) * 100)
        : 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="m-0">Finanzas</h1>
                <Button variant="secondary" onClick={fetchFinances}>
                    <Clock size={18} /> Actualizar
                </Button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' }}>
                        <CurrencyDollar size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>MRR Estimado</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{formatCurrency(summary.mrr)}</h3>
                    </div>
                </Card>

                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
                        <TrendUp size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>ARR Estimado</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{formatCurrency(summary.arr)}</h3>
                    </div>
                </Card>

                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                        <Wallet size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Cobrado</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{formatCurrency(summary.total_collected)}</h3>
                    </div>
                </Card>

                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
                        <Clock size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pendiente</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{formatCurrency(summary.total_pending)}</h3>
                    </div>
                </Card>

                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        <Warning size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fallido</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{formatCurrency(summary.total_failed)}</h3>
                    </div>
                </Card>

                <Card style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                        <CheckCircle size={28} weight="duotone" />
                    </div>
                    <div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tasa de Cobro</p>
                        <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{successRate}%</h3>
                    </div>
                </Card>
            </div>

            {/* Monthly Revenue Chart */}
            <Card style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <ChartBar size={22} color="#6366f1" />
                    <h3 style={{ margin: 0 }}>Ingresos Mensuales (Últimos 12 meses)</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '200px', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {monthly_revenue.map((m) => {
                        const total = m.collected + m.pending + m.failed;
                        const heightPct = total > 0 ? (total / maxMonthly) * 100 : 0;
                        const collectedPct = total > 0 ? (m.collected / total) * 100 : 0;
                        const pendingPct = total > 0 ? (m.pending / total) * 100 : 0;
                        return (
                            <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ position: 'relative', width: '100%', maxWidth: '32px', height: '100%', display: 'flex', alignItems: 'flex-end', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                                    <div style={{ width: '100%', height: `${heightPct}%`, display: 'flex', flexDirection: 'column', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ flex: collectedPct, background: '#22c55e', minHeight: m.collected > 0 ? '1px' : 0 }} />
                                        <div style={{ flex: pendingPct, background: '#eab308', minHeight: m.pending > 0 ? '1px' : 0 }} />
                                        <div style={{ flex: 100 - collectedPct - pendingPct, background: '#ef4444', minHeight: m.failed > 0 ? '1px' : 0 }} />
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>{m.month_name}</span>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} /> Cobrado</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#eab308' }} /> Pendiente</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} /> Fallido</span>
                </div>
            </Card>

            {/* Two columns: Services & Top Clients */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Stack size={22} color="#a855f7" />
                        <h3 style={{ margin: 0 }}>Ingresos por Servicio</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {by_service.map((s, idx) => {
                            const maxService = by_service[0]?.monthly_revenue || 1;
                            const pct = (s.monthly_revenue / maxService) * 100;
                            return (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        <span>{s.service_name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(s.monthly_revenue)}/mes • {s.subscriptions} subs</span>
                                    </div>
                                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #6366f1)', borderRadius: 3 }} />
                                    </div>
                                </div>
                            );
                        })}
                        {by_service.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay datos disponibles.</p>}
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Users size={22} color="#3b82f6" />
                        <h3 style={{ margin: 0 }}>Top Clientes por Ingreso</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {top_clients.map((c, idx) => {
                            const maxClient = top_clients[0]?.monthly_revenue || 1;
                            const pct = (c.monthly_revenue / maxClient) * 100;
                            return (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        <span>{c.client_name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(c.monthly_revenue)}/mes</span>
                                    </div>
                                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #22c55e)', borderRadius: 3 }} />
                                    </div>
                                </div>
                            );
                        })}
                        {top_clients.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay datos disponibles.</p>}
                    </div>
                </Card>
            </div>

            {/* Projections */}
            <Card style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <TrendUp size={22} color="#22c55e" />
                    <h3 style={{ margin: 0 }}>Proyección MRR (Próximos 12 meses)</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '160px', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {projections.map((p) => {
                        const heightPct = (p.projected_mrr / maxProjection) * 100;
                        return (
                            <div key={p.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ position: 'relative', width: '100%', maxWidth: '28px', height: '100%', display: 'flex', alignItems: 'flex-end', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                                    <div style={{ width: '100%', height: `${heightPct}%`, background: 'linear-gradient(180deg, #22c55e, #15803d)', borderRadius: '4px' }} />
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>{p.month_name}</span>
                            </div>
                        );
                    })}
                </div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Proyección basada en suscripciones activas actuales. MRR estimado mensual: <strong>{formatCurrency(summary.mrr)}</strong>
                </p>
            </Card>

            {/* Recent Payments */}
            <Card>
                <h3 style={{ marginBottom: '1rem' }}>Pagos Recientes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recent_payments.map((p) => {
                        const statusColor = p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#eab308' : '#ef4444';
                        const statusLabel = p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : 'Fallido';
                        return (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 500 }}>{p.client_name}</p>
                                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.service_name} - {p.product_name} • {p.date}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 600, color: p.status === 'paid' ? '#22c55e' : 'white' }}>{formatCurrency(p.amount)}</p>
                                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '1rem', background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}` }}>{statusLabel}</span>
                                </div>
                            </div>
                        );
                    })}
                    {recent_payments.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay pagos recientes.</p>}
                </div>
            </Card>
        </div>
    );
};

export default Finances;
