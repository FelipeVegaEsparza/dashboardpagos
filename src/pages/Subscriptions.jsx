import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useModal } from '../hooks/useModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Plus, CurrencyDollar, Prohibit, WhatsappLogo, Trash, PencilSimple } from 'phosphor-react';

const Subscriptions = () => {
    const { modal, showSuccess, showError, showDelete, closeModal } = useModal();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

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
        project_name: '',
        start_date: new Date().toISOString().split('T')[0]
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ project_name: '', next_payment_date: '' });
    const [editingSubscription, setEditingSubscription] = useState(null);

    useEffect(() => {
        fetchSubscriptions();
        fetchClients();
        fetchServices();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            setError(null);
            // CAMBIO: Obtener TODAS las suscripciones, no solo las activas
            // El filtro se aplicará en el frontend
            const response = await api.getSubscriptions();
            console.log('Subscriptions response:', response);
            setSubscriptions(response.items || response || []);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            setError(error.message || 'Error al cargar suscripciones');
            setSubscriptions([]);
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

    const fetchServices = async () => {
        try {
            const response = await api.getServices();
            setServices(response.items || response);
        } catch (error) { 
            console.error('Error fetching services:', error); 
        }
    };

    const handleServiceChange = async (e) => {
        const serviceId = e.target.value;
        setSelectedServiceId(serviceId);
        setNewSubscription({ ...newSubscription, product_id: '' });
        if (serviceId) {
            try {
                const response = await api.getProducts(serviceId);
                setProducts(response.items || response);
            } catch (error) { 
                console.error('Error fetching products:', error); 
            }
        } else {
            setProducts([]);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        
        // Validación básica
        if (!newSubscription.client_id || !newSubscription.product_id || !newSubscription.start_date) {
            showError('Campos incompletos', 'Por favor completa todos los campos requeridos.');
            return;
        }
        
        // Verificar si ya existe una suscripción activa para este cliente/producto
        const clientId = parseInt(newSubscription.client_id);
        const productId = parseInt(newSubscription.product_id);
        
        const existingActiveSubscription = subscriptions.find(
            sub => sub.client_id === clientId && 
                   sub.product_id === productId && 
                   sub.status === 'active'
        );
        
        const existingCancelledSubscription = subscriptions.find(
            sub => sub.client_id === clientId && 
                   sub.product_id === productId && 
                   sub.status === 'cancelled'
        );
        
        if (existingActiveSubscription) {
            showError('Suscripción duplicada', 
                'Este cliente ya tiene una suscripción ACTIVA para este producto.\n\nNo se pueden crear suscripciones duplicadas. Si necesitas renovar o modificar la suscripción existente, usa la función de editar.'
            );
            return;
        }
        
        if (existingCancelledSubscription) {
            // Mostrar advertencia pero permitir continuar
            const confirmReactivate = window.confirm(
                `Este cliente tiene una suscripción CANCELADA para este producto.\n\n` +
                `¿Deseas reactivar la suscripción existente en lugar de crear una nueva?\n\n` +
                `- Sí: Reactivará la suscripción cancelada\n` +
                `- No: Intentará crear una nueva (puede fallar si el backend no lo permite)`
            );
            
            if (confirmReactivate) {
                // Reactivar la suscripción existente
                try {
                    await api.updateSubscription({
                        id: existingCancelledSubscription.id,
                        status: 'active',
                        next_payment_date: newSubscription.start_date,
                        project_name: newSubscription.project_name || existingCancelledSubscription.project_name
                    });
                    setShowModal(false);
                    setNewSubscription({
                        client_id: '',
                        product_id: '',
                        project_name: '',
                        start_date: new Date().toISOString().split('T')[0]
                    });
                    setSelectedServiceId('');
                    fetchSubscriptions();
                    showSuccess('¡Suscripción reactivada!', 'La suscripción cancelada se ha reactivado correctamente.');
                    return;
                } catch (error) {
                    showError('Error al reactivar', error.message || 'No se pudo reactivar la suscripción.');
                    return;
                }
            }
            // Si el usuario dice "No", continuar con la creación normal
        }
        
        setIsSubmitting(true);
        try {
            const payload = {
                client_id: clientId,
                product_id: productId,
                project_name: newSubscription.project_name || null,
                start_date: newSubscription.start_date
            };
            console.log('Creating subscription with payload:', payload);
            await api.createSubscription(payload);
            setShowModal(false);
            setNewSubscription({
                client_id: '',
                product_id: '',
                project_name: '',
                start_date: new Date().toISOString().split('T')[0]
            });
            setSelectedServiceId('');
            fetchSubscriptions();
            showSuccess('¡Suscripción creada!', 'La suscripción se ha creado correctamente.');
        } catch (error) {
            console.error('Error creating subscription:', error);
            
            // Mensajes de error más amigables
            let errorMessage = error.message || 'Error desconocido';
            
            if (errorMessage.includes('already has an active subscription')) {
                errorMessage = 'Este cliente ya tiene una suscripción activa para este producto. No se pueden crear suscripciones duplicadas.';
            } else if (errorMessage.includes('Client not found')) {
                errorMessage = 'El cliente seleccionado no existe.';
            } else if (errorMessage.includes('Product not found')) {
                errorMessage = 'El producto seleccionado no existe.';
            } else if (errorMessage.includes('Validation failed')) {
                errorMessage = 'Por favor verifica que todos los datos sean correctos.';
            }
            
            showError('Error al crear suscripción', errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const navigate = useNavigate();

    const handleRegisterPaymentClick = (sub) => {
        // Redirigir a la página de pagos con el ID de la suscripción pre-seleccionada
        navigate('/payments', { state: { preselectedSubscription: sub } });
    };

    const openEditModal = (sub) => {
        setEditingSubscription(sub);
        setEditForm({
            project_name: sub.project_name || '',
            next_payment_date: sub.next_payment_date || ''
        });
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingSubscription(null);
        setEditForm({ project_name: '', next_payment_date: '' });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingSubscription) return;

        setIsSubmitting(true);
        try {
            await api.updateSubscription({
                id: editingSubscription.id,
                status: editingSubscription.status,
                project_name: editForm.project_name || null,
                next_payment_date: editForm.next_payment_date
            });
            setShowEditModal(false);
            setEditingSubscription(null);
            setEditForm({ project_name: '', next_payment_date: '' });
            fetchSubscriptions();
            showSuccess('¡Suscripción actualizada!', 'Los cambios se guardaron correctamente.');
        } catch (error) {
            console.error('Error updating subscription:', error);
            showError('Error al actualizar', error.message || 'No se pudo guardar los cambios.');
        } finally {
            setIsSubmitting(false);
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

    const handleCancelSubscription = (sub) => {
        const message = sub.status === 'active' 
            ? `¿Estás seguro de cancelar la suscripción de "${sub.client_name}" para "${sub.product_name}"?\n\nEsta acción no eliminará el historial de pagos, pero la suscripción ya no estará activa.`
            : `¿Estás seguro de eliminar la suscripción de "${sub.client_name}"?`;
        
        showDelete(
            '¿Cancelar suscripción?',
            message,
            async () => {
                try {
                    await api.deleteSubscription(sub.id);
                    showSuccess('Suscripción cancelada', 'La suscripción se ha cancelado correctamente.');
                    fetchSubscriptions(); // Recargar la lista
                } catch (error) {
                    console.error('Error canceling subscription:', error);
                    showError('Error', 'No se pudo cancelar la suscripción: ' + (error.message || 'Error desconocido'));
                }
            }
        );
    };

    const filteredSubscriptions = subscriptions.filter(sub => {
        // CAMBIO: Filtrar solo suscripciones activas
        if (sub.status !== 'active') return false;
        
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
                <h1 className="m-0">Suscripciones Activas</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => navigate('/subscriptions/cancelled')}
                        title="Ver suscripciones canceladas"
                    >
                        <Trash size={18} /> Canceladas
                    </Button>
                    <Button onClick={() => setShowModal(true)}>
                        <Plus size={20} /> Nueva
                    </Button>
                </div>
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
            ) : error ? (
                <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        ⚠️ Error al cargar suscripciones
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                    <button 
                        onClick={fetchSubscriptions}
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
                                        {sub.project_name && <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>• {sub.project_name}</span>}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Próximo pago: <strong>{sub.next_payment_date}</strong>
                                    </p>
                                </div>
                                <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button variant="secondary" onClick={() => handleRegisterPaymentClick(sub)} title="Registrar Pago">
                                        <CurrencyDollar size={18} /> Pagar
                                    </Button>
                                    <Button variant="secondary" onClick={() => openEditModal(sub)} title="Editar Suscripción">
                                        <PencilSimple size={18} />
                                    </Button>
                                    {sub.status === 'active' && (
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => handleCancelSubscription(sub)} 
                                            title="Cancelar Suscripción"
                                            style={{ 
                                                background: 'rgba(239, 68, 68, 0.1)', 
                                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                                color: '#ef4444'
                                            }}
                                        >
                                            <Prohibit size={18} />
                                        </Button>
                                    )}
                                    {sub.client_phone && (
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => {
                                                const phone = sub.client_phone.replace(/\D/g, '');
                                                const message = `Hola ${sub.client_name}, te escribo sobre tu suscripción a ${sub.service_name} - ${sub.product_name}.`;
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
                                <label className="text-sm text-muted mb-1 block">Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Tienda Online, App Móvil, etc."
                                    value={newSubscription.project_name}
                                    onChange={e => setNewSubscription({ ...newSubscription, project_name: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
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
                                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingSubscription && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title="Editar Suscripción">
                        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Cliente</label>
                                <input
                                    type="text"
                                    value={editingSubscription.client_name}
                                    disabled
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Servicio - Producto</label>
                                <input
                                    type="text"
                                    value={`${editingSubscription.service_name} - ${editingSubscription.product_name}`}
                                    disabled
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Tienda Online, App Móvil, etc."
                                    value={editForm.project_name}
                                    onChange={e => setEditForm({ ...editForm, project_name: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm text-muted mb-1 block">Fecha de Próximo Pago</label>
                                <input
                                    type="date"
                                    value={editForm.next_payment_date}
                                    onChange={e => setEditForm({ ...editForm, next_payment_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button type="button" variant="secondary" onClick={closeEditModal} disabled={isSubmitting}>Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Modal de notificaciones personalizadas */}
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

export default Subscriptions;
