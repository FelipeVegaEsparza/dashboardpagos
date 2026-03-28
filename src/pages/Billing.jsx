import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useModal } from '../hooks/useModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { 
    Envelope, 
    Calendar, 
    Warning, 
    CheckCircle, 
    Clock, 
    PaperPlaneTilt,
    Spinner,
    WhatsappLogo
} from 'phosphor-react';

const Billing = () => {
    const { modal, showSuccess, showError, showConfirm, closeModal } = useModal();
    const [subscriptions, setSubscriptions] = useState({
        overdue: [],
        due_today: [],
        due_soon: [],
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(null);
    
    // Email preview modal
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState('reminder');
    const [customMessage, setCustomMessage] = useState('');

    useEffect(() => {
        fetchBillingData();
    }, []);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getBillingSubscriptions();
            setSubscriptions(response);
        } catch (error) {
            console.error('Error fetching billing data:', error);
            setError(error.message || 'Error al cargar datos de cobranza');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async (sub, template = 'reminder') => {
        setSendingEmail(sub.id);
        try {
            await api.sendBillingEmail(sub.id, template);
            showSuccess('Email enviado', `El recordatorio se ha enviado a ${sub.client_email}`);
        } catch (error) {
            console.error('Error sending email:', error);
            showError('Error', 'No se pudo enviar el email: ' + (error.message || 'Error desconocido'));
        } finally {
            setSendingEmail(null);
        }
    };

    const openPreviewModal = (sub, template) => {
        setSelectedSubscription(sub);
        setSelectedTemplate(template);
        setCustomMessage('');
        setShowPreviewModal(true);
    };

    const handleSendWithCustomMessage = async () => {
        if (!selectedSubscription) return;
        
        setSendingEmail(selectedSubscription.id);
        setShowPreviewModal(false);
        
        try {
            await api.sendBillingEmail(selectedSubscription.id, selectedTemplate, customMessage);
            showSuccess('Email enviado', `El recordatorio se ha enviado a ${selectedSubscription.client_email}`);
        } catch (error) {
            console.error('Error sending email:', error);
            showError('Error', 'No se pudo enviar el email: ' + (error.message || 'Error desconocido'));
        } finally {
            setSendingEmail(null);
            setSelectedSubscription(null);
            setCustomMessage('');
        }
    };

    const getTemplateLabel = (template) => {
        switch (template) {
            case 'overdue': return 'Vencido';
            case 'final_notice': return 'Aviso Final';
            case 'reminder':
            default: return 'Recordatorio';
        }
    };

    const getTemplateColor = (template) => {
        switch (template) {
            case 'overdue': return '#ef4444';
            case 'final_notice': return '#7f1d1d';
            case 'reminder':
            default: return '#6366f1';
        }
    };

    const renderSubscriptionCard = (sub, type) => {
        const daysUntilDue = sub.days_until_due;
        let icon, color, badge;
        
        if (type === 'overdue') {
            icon = <Warning size={24} color="#ef4444" weight="fill" />;
            color = '#ef4444';
            badge = `Vencido hace ${Math.abs(daysUntilDue)} días`;
        } else if (type === 'due_today') {
            icon = <Clock size={24} color="#eab308" />;
            color = '#eab308';
            badge = 'Vence hoy';
        } else {
            icon = <Calendar size={24} color="#6366f1" />;
            color = '#6366f1';
            badge = `Vence en ${daysUntilDue} días`;
        }

        const suggestedTemplate = type === 'overdue' ? 'overdue' : type === 'due_today' ? 'reminder' : 'reminder';

        return (
            <Card key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '12px', 
                        background: `${color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {icon}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 className="font-semibold m-0">{sub.client_name}</h3>
                            <span style={{
                                fontSize: '0.75rem',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '1rem',
                                background: `${color}20`,
                                color: color,
                                border: `1px solid ${color}`
                            }}>
                                {badge}
                            </span>
                        </div>
                        <p className="text-sm text-muted" style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                            {sub.service_name} - {sub.product_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            <strong>{formatCurrency(sub.price)}</strong> • Vencimiento: <strong>{sub.next_payment_date}</strong>
                            {sub.client_email && (
                                <span style={{ marginLeft: '0.5rem' }}>• {sub.client_email}</span>
                            )}
                            {sub.last_email_sent && (
                                <span style={{ marginLeft: '0.5rem', color: '#eab308' }}>
                                    • 📧 Email enviado: {new Date(sub.last_email_sent).toLocaleDateString('es-ES')}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => openPreviewModal(sub, suggestedTemplate)}
                        disabled={!sub.client_email || sendingEmail === sub.id}
                        title={sub.client_email ? 'Personalizar email' : 'Cliente sin email'}
                    >
                        <Envelope size={18} />
                    </Button>
                    <Button 
                        onClick={() => handleSendEmail(sub, suggestedTemplate)}
                        disabled={!sub.client_email || sendingEmail === sub.id}
                        title={sub.client_email ? 'Enviar recordatorio' : 'Cliente sin email'}
                    >
                        {sendingEmail === sub.id ? (
                            <Spinner size={18} className="spin" />
                        ) : (
                            <PaperPlaneTilt size={18} />
                        )}
                        Enviar
                    </Button>
                    {sub.client_phone && (
                        <Button 
                            variant="secondary" 
                            onClick={() => {
                                const phone = sub.client_phone.replace(/\D/g, '');
                                const message = `Hola ${sub.client_name}, te escribo sobre tu suscripción a ${sub.service_name} - ${sub.product_name}. El pago vence el ${sub.next_payment_date}.`;
                                const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                                window.open(whatsappUrl, '_blank');
                            }}
                            title="Contactar por WhatsApp"
                            style={{ 
                                background: 'rgba(37, 211, 102, 0.1)', 
                                borderColor: 'rgba(37, 211, 102, 0.3)',
                                color: '#25d366'
                            }}
                        >
                            <WhatsappLogo size={18} />
                        </Button>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="m-0">Cobranza</h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                        Gestiona recordatorios de pago para suscripciones próximas a vencer o vencidas
                    </p>
                </div>
                <Button onClick={fetchBillingData} variant="secondary">
                    <Spinner size={18} /> Actualizar
                </Button>
            </div>

            {/* Summary Cards */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <Card style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>
                        {subscriptions.overdue.length}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vencidas</div>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#eab308' }}>
                        {subscriptions.due_today.length}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vencen hoy</div>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#6366f1' }}>
                        {subscriptions.due_soon.length}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Próximas a vencer</div>
                </Card>
            </div>

            {/* Content */}
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
                        ⚠️ Error al cargar datos
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                    <button 
                        onClick={fetchBillingData}
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
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Overdue Section */}
                    {subscriptions.overdue.length > 0 && (
                        <div>
                            <h2 style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                color: '#ef4444',
                                fontSize: '1.1rem',
                                marginBottom: '1rem'
                            }}>
                                <Warning size={20} weight="fill" />
                                Suscripciones Vencidas ({subscriptions.overdue.length})
                            </h2>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {subscriptions.overdue.map(sub => renderSubscriptionCard(sub, 'overdue'))}
                            </div>
                        </div>
                    )}

                    {/* Due Today Section */}
                    {subscriptions.due_today.length > 0 && (
                        <div>
                            <h2 style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                color: '#eab308',
                                fontSize: '1.1rem',
                                marginBottom: '1rem'
                            }}>
                                <Clock size={20} />
                                Vencen Hoy ({subscriptions.due_today.length})
                            </h2>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {subscriptions.due_today.map(sub => renderSubscriptionCard(sub, 'due_today'))}
                            </div>
                        </div>
                    )}

                    {/* Due Soon Section */}
                    {subscriptions.due_soon.length > 0 && (
                        <div>
                            <h2 style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                color: '#6366f1',
                                fontSize: '1.1rem',
                                marginBottom: '1rem'
                            }}>
                                <Calendar size={20} />
                                Próximas a Vencer ({subscriptions.due_soon.length})
                            </h2>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {subscriptions.due_soon.map(sub => renderSubscriptionCard(sub, 'due_soon'))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {subscriptions.total === 0 && (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '4rem 2rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '16px',
                            border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}>
                            <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ color: '#22c55e', marginBottom: '0.5rem' }}>
                                ¡Todo al día!
                            </h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                No hay suscripciones pendientes de cobro en los próximos 7 días
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Email Preview Modal */}
            {showPreviewModal && selectedSubscription && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <Card style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>
                            Preparar Email de {getTemplateLabel(selectedTemplate)}
                        </h3>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Para: <strong>{selectedSubscription.client_name}</strong> ({selectedSubscription.client_email})
                            </label>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Servicio: {selectedSubscription.service_name} - {selectedSubscription.product_name}
                            </label>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Plantilla:
                            </label>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                            >
                                <option value="reminder">Recordatorio amable</option>
                                <option value="overdue">Pago vencido</option>
                                <option value="final_notice">Aviso final</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Mensaje personalizado (opcional):
                            </label>
                            <textarea
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="Agrega un mensaje personalizado al email..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ 
                            padding: '1rem', 
                            background: 'rgba(255,255,255,0.05)', 
                            borderRadius: '8px',
                            marginBottom: '1.5rem'
                        }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Vista previa del email:
                            </p>
                            <div style={{ 
                                padding: '1rem', 
                                background: 'white', 
                                color: '#333',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}>
                                <p><strong>Asunto:</strong> {getTemplateLabel(selectedTemplate)} - {selectedSubscription.service_name}</p>
                                <hr style={{ margin: '0.5rem 0' }} />
                                <p>Estimado/a <strong>{selectedSubscription.client_name}</strong>,</p>
                                <p>Le escribimos sobre su suscripción a <strong>{selectedSubscription.service_name}</strong>...</p>
                                {customMessage && (
                                    <>
                                        <hr style={{ margin: '0.5rem 0' }} />
                                        <p><strong>Nota adicional:</strong></p>
                                        <p>{customMessage}</p>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSendWithCustomMessage} disabled={sendingEmail === selectedSubscription.id}>
                                {sendingEmail === selectedSubscription.id ? (
                                    <Spinner size={18} className="spin" />
                                ) : (
                                    <PaperPlaneTilt size={18} />
                                )}
                                Enviar Email
                            </Button>
                        </div>
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

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default Billing;
