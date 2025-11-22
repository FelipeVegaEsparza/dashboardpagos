import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Plus, Trash, CheckCircle, XCircle, CurrencyDollar, ClockCounterClockwise } from 'phosphor-react';

const Subscriptions = () => {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedSubForPayment, setSelectedSubForPayment] = useState(null);
    const [paymentData, setPaymentData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], receipt: null });

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Filters
    const [filterService, setFilterService] = useState('');
    const [filterProduct, setFilterProduct] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Data for form
    const [clients, setClients] = useState([]);
    const [services, setServices] = useState([]);
    const [products, setProducts] = useState([]);

    // Form state
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [newSubscription, setNewSubscription] = useState({
        client_id: '',
        product_id: '',
        start_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchSubscriptions();
        fetchClients();
        fetchServices();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            const data = await api.get('/subscriptions.php?all=true');
            console.log('Subscriptions data:', data);
            setSubscriptions(data || []);
        } catch (error) {
            console.error(error);
            setSubscriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const data = await api.get('/clients.php');
            setClients(data);
        } catch (error) { console.error(error); }
    };

    const fetchServices = async () => {
        try {
            const data = await api.get('/services.php');
            setServices(data);
        } catch (error) { console.error(error); }
    };

    const handleServiceChange = async (e) => {
        const serviceId = e.target.value;
        setSelectedServiceId(serviceId);
        setNewSubscription({ ...newSubscription, product_id: '' });
        if (serviceId) {
            try {
                const data = await api.get(`/products.php?service_id=${serviceId}`);
                setProducts(data);
            } catch (error) { console.error(error); }
        } else {
            setProducts([]);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subscriptions.php', newSubscription);
            setShowModal(false);
            setNewSubscription({
                client_id: '',
                product_id: '',
                start_date: new Date().toISOString().split('T')[0]
            });
            setSelectedServiceId('');
            fetchSubscriptions();
        } catch (error) {
            console.error(error);
        }
    };

    const openPaymentModal = (sub) => {
        setSelectedSubForPayment(sub);
        setPaymentData({
            amount: sub.price,
            date: new Date().toISOString().split('T')[0],
            receipt: null
        });
        setShowPaymentModal(true);
    };

    const handleRegisterPayment = async (e) => {
        e.preventDefault();
        if (!selectedSubForPayment) return;

        try {
            const formData = new FormData();
            formData.append('subscription_id', selectedSubForPayment.id);
            formData.append('amount', paymentData.amount);
            formData.append('date', paymentData.date);
            if (paymentData.receipt) {
                formData.append('receipt', paymentData.receipt);
            }

            await api.post('/payments.php', formData);
            setShowPaymentModal(false);
            setSelectedSubForPayment(null);
            fetchSubscriptions(); // Refresh to see updated dates
        } catch (error) {
            console.error(error);
            alert('Error al registrar el pago');
        }
    };

    const getPaymentStatus = (dateString) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const paymentDate = new Date(dateString);
        paymentDate.setHours(0, 0, 0, 0);

        const diffTime = paymentDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { status: 'overdue', label: `Atrasado ${Math.abs(diffDays)} días`, color: '#ef4444' };
        if (diffDays === 0) return { status: 'due', label: 'Vence hoy', color: '#eab308' };
        if (diffDays <= 7) return { status: 'soon', label: `Vence en ${diffDays} días`, color: '#eab308' };
        return { status: 'ok', label: 'Al día', color: '#22c55e' };
    };

    const openHistoryModal = async (sub) => {
        setSelectedSubForPayment(sub);
        setShowHistoryModal(true);
        setLoadingHistory(true);
        try {
            const data = await api.get(`/payments.php?subscription_id=${sub.id}`);
            setPaymentHistory(data);
        } catch (error) {
            console.error(error);
            setPaymentHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const filteredSubscriptions = subscriptions.filter(sub => {
        const statusInfo = getPaymentStatus(sub.next_payment_date);
        const matchesService = filterService ? sub.service_name === filterService : true;
        const matchesProduct = filterProduct ? sub.product_name === filterProduct : true;
        const matchesStatus = filterStatus ? statusInfo.status === filterStatus : true;
        return matchesService && matchesProduct && matchesStatus;
    });

    const uniqueProducts = [...new Set(subscriptions.map(s => s.product_name))];

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="m-0">Suscripciones</h1>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={20} /> Nueva Suscripción
                </Button>
            </div>

            <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '2rem',
                alignItems: 'center',
                background: 'rgba(30, 41, 59, 0.2)',
                padding: '1rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <select
                    value={filterService}
                    onChange={e => setFilterService(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '0.95rem'
                    }}
                >
                    <option value="">Todos los Servicios</option>
                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>

                <select
                    value={filterProduct}
                    onChange={e => setFilterProduct(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '0.95rem'
                    }}
                >
                    <option value="">Todos los Productos</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '0.95rem'
                    }}
                >
                    <option value="">Todos los Estados</option>
                    <option value="ok">Al día</option>
                    <option value="soon">Vence pronto</option>
                    <option value="due">Vence hoy</option>
                    <option value="overdue">Atrasado</option>
                </select>
            </div>

            {loading ? (
                <p>Cargando...</p>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredSubscriptions.map((sub) => {
                        const statusInfo = getPaymentStatus(sub.next_payment_date);
                        return (
                            <Card key={sub.id} className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <h3 className="font-semibold m-0">{sub.client_name || 'Cliente Desconocido'}</h3>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '1rem',
                                            background: `${statusInfo.color}20`,
                                            color: statusInfo.color,
                                            border: `1px solid ${statusInfo.color}`
                                        }}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted" style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                                        {sub.service_name} - {sub.product_name} ({formatCurrency(sub.price)})
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Próximo pago: <strong>{sub.next_payment_date}</strong>
                                    </p>
                                </div>
                                <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button variant="secondary" onClick={() => openHistoryModal(sub)} title="Ver Historial">
                                        <ClockCounterClockwise size={18} />
                                    </Button>
                                    <Button variant="secondary" onClick={() => openPaymentModal(sub)} title="Registrar Pago">
                                        <CurrencyDollar size={18} /> Pagar
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                    {filteredSubscriptions.length === 0 && (
                        <div className="text-center text-muted p-8">No hay suscripciones registradas.</div>
                    )}
                </div>
            )}

            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title="Nueva Suscripción">
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Cliente</label>
                                <select
                                    value={newSubscription.client_id}
                                    onChange={e => setNewSubscription({ ...newSubscription, client_id: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                >
                                    <option value="">Seleccionar Cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Servicio</label>
                                <select
                                    value={selectedServiceId}
                                    onChange={handleServiceChange}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                >
                                    <option value="">Seleccionar Servicio</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Plan / Producto</label>
                                <select
                                    value={newSubscription.product_id}
                                    onChange={e => setNewSubscription({ ...newSubscription, product_id: e.target.value })}
                                    required
                                    disabled={!selectedServiceId}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                >
                                    <option value="">Seleccionar Producto</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} - {formatCurrency(p.price)} ({p.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Fecha de Inicio</label>
                                <input
                                    type="date"
                                    value={newSubscription.start_date}
                                    onChange={e => setNewSubscription({ ...newSubscription, start_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                                <Button type="submit">Guardar</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {showPaymentModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '400px' }} title="Registrar Pago">
                        <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p className="text-sm text-muted">
                                Registrando pago para <strong>{selectedSubForPayment?.client_name}</strong>
                            </p>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Monto</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={paymentData.amount}
                                    onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Fecha del Pago</label>
                                <input
                                    type="date"
                                    value={paymentData.date}
                                    onChange={e => setPaymentData({ ...paymentData, date: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Comprobante (Opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={e => setPaymentData({ ...paymentData, receipt: e.target.files[0] })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
                                <Button type="submit">Registrar</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {showHistoryModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }} title={`Historial de Pagos - ${selectedSubForPayment?.client_name}`}>
                        {loadingHistory ? (
                            <p>Cargando historial...</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Fecha</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Monto</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Estado</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Comprobante</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentHistory.map(payment => (
                                        <tr key={payment.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem' }}>{payment.date}</td>
                                            <td style={{ padding: '0.5rem' }}>{formatCurrency(payment.amount)}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.1rem 0.5rem',
                                                    borderRadius: '1rem',
                                                    background: payment.status === 'paid' ? '#22c55e20' : '#ef444420',
                                                    color: payment.status === 'paid' ? '#22c55e' : '#ef4444'
                                                }}>
                                                    {payment.status === 'paid' ? 'Pagado' : payment.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                {payment.receipt_url ? (
                                                    <a
                                                        href={payment.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}
                                                    >
                                                        Ver
                                                    </a>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {paymentHistory.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No hay pagos registrados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                        <div className="flex justify-end mt-4" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Cerrar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Subscriptions;
