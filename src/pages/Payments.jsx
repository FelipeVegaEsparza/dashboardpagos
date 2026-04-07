import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useModal } from '../hooks/useModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Plus, CurrencyDollar, Calendar, User, CheckCircle } from 'phosphor-react';

const Payments = () => {
    const location = useLocation();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { modal, showSuccess, showError, closeModal } = useModal();
    
    // Check for preselected subscription from navigation
    const preselectedSub = location.state?.preselectedSubscription;

    // Filters
    const [filterClient, setFilterClient] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Data for form
    const [clients, setClients] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);

    // New Payment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedSubscription, setSelectedSubscription] = useState('');
    const [paymentData, setPaymentData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        receipt: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPayments();
        fetchClients();
        fetchSubscriptions();
        
        // If coming from subscriptions with preselected subscription, open payment modal
        if (preselectedSub) {
            setSelectedClient(preselectedSub.client_id.toString());
            setSelectedSubscription(preselectedSub.id.toString());
            setPaymentData({
                amount: preselectedSub.price || '',
                date: new Date().toISOString().split('T')[0],
                receipt: null
            });
            setShowPaymentModal(true);
        }
    }, [preselectedSub]);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            setError(null);
            // Obtener TODOS los pagos en una sola petición
            const response = await api.get('/payments.php?limit=1000');
            const paymentsData = response.data?.items || response.items || response || [];
            setPayments(paymentsData);
        } catch (error) {
            console.error('Error fetching payments:', error);
            setError(error.message || 'Error al cargar pagos');
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const response = await api.getClients({ limit: 1000 });
            setClients(response.items || response);
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            const response = await api.getSubscriptions({ limit: 1000 });
            setSubscriptions(response.items || response || []);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        }
    };

    const handleClientChange = (e) => {
        const clientId = e.target.value;
        setSelectedClient(clientId);
        setSelectedSubscription('');
    };

    const getFilteredSubscriptions = () => {
        if (!selectedClient) return [];
        return subscriptions.filter(sub => 
            sub.client_id === parseInt(selectedClient) && 
            sub.status === 'active'
        );
    };

    const handleRegisterPayment = async (e) => {
        e.preventDefault();
        
        if (!selectedSubscription) {
            showError('Error', 'Por favor selecciona una suscripción');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('subscription_id', selectedSubscription);
            formData.append('amount', paymentData.amount);
            formData.append('date', paymentData.date);
            if (paymentData.receipt) {
                formData.append('receipt', paymentData.receipt);
            }

            await api.createPayment(formData);
            setShowPaymentModal(false);
            setSelectedClient('');
            setSelectedSubscription('');
            setPaymentData({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                receipt: null
            });
            fetchPayments();
            showSuccess('¡Pago registrado!', 'El pago se ha registrado correctamente.');
        } catch (error) {
            console.error('Error registering payment:', error);
            showError('Error', 'No se pudo registrar el pago: ' + (error.message || 'Error desconocido'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredPayments = payments.filter(payment => {
        const matchesClient = filterClient ? payment.client_name?.toLowerCase().includes(filterClient.toLowerCase()) : true;
        const matchesStatus = filterStatus ? payment.status === filterStatus : true;
        return matchesClient && matchesStatus;
    });

    const getStatusInfo = (status) => {
        switch (status) {
            case 'paid':
                return { label: 'Pagado', color: '#22c55e', bgColor: '#22c55e20' };
            case 'pending':
                return { label: 'Pendiente', color: '#eab308', bgColor: '#eab30820' };
            case 'failed':
                return { label: 'Fallido', color: '#ef4444', bgColor: '#ef444420' };
            default:
                return { label: status, color: '#6b7280', bgColor: '#6b728020' };
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="m-0">Pagos</h1>
                <Button onClick={() => setShowPaymentModal(true)}>
                    <Plus size={20} /> Registrar Pago
                </Button>
            </div>

            {/* Filters */}
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
                <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={filterClient}
                    onChange={e => setFilterClient(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: 'var(--text-main)',
                        fontSize: '0.95rem'
                    }}
                />

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
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente</option>
                    <option value="failed">Fallido</option>
                </select>
            </div>

            {/* Payments List */}
            {loading ? (
                <p>Cargando...</p>
            ) : error ? (
                <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        ⚠️ Error al cargar pagos
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                    <button 
                        onClick={fetchPayments}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredPayments.map((payment) => {
                        const statusInfo = getStatusInfo(payment.status);
                        return (
                            <Card key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <h3 className="font-semibold m-0">{payment.client_name || 'Cliente'}</h3>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '1rem',
                                            background: statusInfo.bgColor,
                                            color: statusInfo.color,
                                            border: `1px solid ${statusInfo.color}`
                                        }}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted" style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                                        {payment.service_name} - {payment.product_name}
                                        {payment.project_name && <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>• {payment.project_name}</span>}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Fecha: <strong>{payment.date}</strong>
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#22c55e', margin: 0 }}>
                                        {formatCurrency(payment.amount)}
                                    </p>
                                    {payment.receipt_url && (
                                        <a
                                            href={payment.receipt_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.875rem' }}
                                        >
                                            Ver comprobante
                                        </a>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                    {filteredPayments.length === 0 && (
                        <div className="text-center text-muted p-8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                            No hay pagos registrados.
                        </div>
                    )}
                </div>
            )}

            {/* New Payment Modal */}
            {showPaymentModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title="Registrar Pago">
                        <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Cliente</label>
                                <select
                                    value={selectedClient}
                                    onChange={handleClientChange}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                >
                                    <option value="">Seleccionar Cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Suscripción (Servicio - Producto)</label>
                                <select
                                    value={selectedSubscription}
                                    onChange={e => setSelectedSubscription(e.target.value)}
                                    required
                                    disabled={!selectedClient}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                >
                                    <option value="">Seleccionar Suscripción</option>
                                    {getFilteredSubscriptions().map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.service_name} - {sub.product_name}{sub.project_name ? ` • ${sub.project_name}` : ''} ({formatCurrency(sub.price)})
                                        </option>
                                    ))}
                                </select>
                            </div>

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
                                <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)} disabled={isSubmitting}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Registrando...' : 'Registrar'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Modal de notificaciones */}
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                confirmText={modal.confirmText}
                cancelText={modal.cancelText}
                confirmVariant={modal.confirmVariant}
            />
        </div>
    );
};

export default Payments;
