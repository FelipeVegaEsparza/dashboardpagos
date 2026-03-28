import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useModal } from '../hooks/useModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Trash, ArrowLeft, Warning } from 'phosphor-react';

const CancelledSubscriptions = () => {
    const navigate = useNavigate();
    const { modal, showSuccess, showError, showDelete, closeModal } = useModal();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filterClient, setFilterClient] = useState('');
    const [filterService, setFilterService] = useState('');

    useEffect(() => {
        fetchCancelledSubscriptions();
    }, []);

    const fetchCancelledSubscriptions = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getSubscriptions({ status: 'cancelled' });
            setSubscriptions(response.items || response || []);
        } catch (error) {
            console.error('Error fetching cancelled subscriptions:', error);
            setError(error.message || 'Error al cargar suscripciones canceladas');
            setSubscriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePermanentDelete = (sub) => {
        showDelete(
            '¿Eliminar permanentemente?',
            `¿Estás seguro de eliminar definitivamente la suscripción de "${sub.client_name}" para "${sub.product_name}"?\n\n⚠️ Esta acción NO se puede deshacer. Los pagos asociados también serán eliminados.`,
            async () => {
                try {
                    await api.permanentlyDeleteSubscription(sub.id);
                    showSuccess('Suscripción eliminada', 'La suscripción ha sido eliminada permanentemente.');
                    fetchCancelledSubscriptions();
                } catch (error) {
                    console.error('Error deleting subscription:', error);
                    showError('Error', 'No se pudo eliminar la suscripción: ' + (error.message || 'Error desconocido'));
                }
            },
            { confirmText: 'Eliminar Permanentemente' }
        );
    };

    const filteredSubscriptions = subscriptions.filter(sub => {
        const matchesClient = filterClient 
            ? sub.client_name?.toLowerCase().includes(filterClient.toLowerCase()) 
            : true;
        const matchesService = filterService 
            ? sub.service_name?.toLowerCase().includes(filterService.toLowerCase()) 
            : true;
        return matchesClient && matchesService;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => navigate('/subscriptions')}
                        title="Volver a Suscripciones"
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="m-0">Suscripciones Canceladas</h1>
                </div>
            </div>

            {/* Info Banner */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '12px',
                color: '#eab308'
            }}>
                <Warning size={24} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Estas suscripciones han sido canceladas. Puedes eliminarlas permanentemente si ya no las necesitas.
                </p>
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

                <input
                    type="text"
                    placeholder="Buscar servicio..."
                    value={filterService}
                    onChange={e => setFilterService(e.target.value)}
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
            </div>

            {/* Subscriptions List */}
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
                        ⚠️ Error al cargar suscripciones canceladas
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                    <button 
                        onClick={fetchCancelledSubscriptions}
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
                    {filteredSubscriptions.map((sub) => (
                        <Card key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <h3 className="font-semibold m-0">{sub.client_name || 'Cliente Desconocido'}</h3>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '1rem',
                                        background: '#ef444420',
                                        color: '#ef4444',
                                        border: '1px solid #ef4444'
                                    }}>
                                        Cancelada
                                    </span>
                                </div>
                                <p className="text-sm text-muted" style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                                    {sub.service_name} - {sub.product_name} ({formatCurrency(sub.price)})
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Fecha inicio: <strong>{sub.start_date}</strong> | Próximo pago: <strong>{sub.next_payment_date}</strong>
                                </p>
                            </div>
                            <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button 
                                    variant="danger" 
                                    onClick={() => handlePermanentDelete(sub)} 
                                    title="Eliminar Permanentemente"
                                >
                                    <Trash size={18} /> Eliminar
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {filteredSubscriptions.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No hay suscripciones canceladas</p>
                            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                Las suscripciones canceladas aparecerán aquí
                            </p>
                        </div>
                    )}
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

export default CancelledSubscriptions;
