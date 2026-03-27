import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { Plus, Trash, PencilSimple, MagnifyingGlass, CaretLeft, CaretRight } from 'phosphor-react';

const Clients = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });
    const [formErrors, setFormErrors] = useState({});
    
    // Pagination state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1
    });
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchClients();
    }, [pagination.page, search]);

    const fetchClients = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = {
                page: pagination.page,
                limit: pagination.limit
            };
            
            if (search.trim()) {
                params.search = search.trim();
            }
            
            const response = await api.getClients(params);
            
            if (response.items) {
                setClients(response.items);
                if (response.pagination) {
                    setPagination(prev => ({
                        ...prev,
                        ...response.pagination
                    }));
                }
            } else {
                setClients(response);
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            setError(error.message || 'Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const errors = {};
        
        if (!newClient.name?.trim()) {
            errors.name = 'Name is required';
        } else if (newClient.name.length < 2) {
            errors.name = 'Name must be at least 2 characters';
        }
        
        if (newClient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) {
            errors.email = 'Invalid email format';
        }
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        try {
            if (editingClient) {
                await api.updateClient({ ...newClient, id: editingClient.id });
            } else {
                await api.createClient(newClient);
            }
            
            setShowModal(false);
            setNewClient({ name: '', email: '', phone: '' });
            setEditingClient(null);
            setFormErrors({});
            fetchClients();
        } catch (error) {
            console.error('Error saving client:', error);
            setFormErrors({ submit: error.message || 'Failed to save client' });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este cliente?')) {
            return;
        }
        
        try {
            await api.deleteClient(id);
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert(error.message || 'Failed to delete client');
        }
    };

    const openEditModal = (client) => {
        setEditingClient(client);
        setNewClient({
            name: client.name,
            email: client.email || '',
            phone: client.phone || ''
        });
        setFormErrors({});
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingClient(null);
        setNewClient({ name: '', email: '', phone: '' });
        setFormErrors({});
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingClient(null);
        setNewClient({ name: '', email: '', phone: '' });
        setFormErrors({});
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1.5rem' 
            }}>
                <h1 className="m-0">Clientes</h1>
                <Button onClick={openCreateModal}>
                    <Plus size={20} /> Nuevo Cliente
                </Button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <MagnifyingGlass 
                        size={20} 
                        style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Buscar clientes..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 3rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'white'
                        }}
                    />
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Card style={{ 
                    marginBottom: '1rem', 
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ color: '#ef4444' }}>{error}</div>
                </Card>
            )}

            {/* Clients List */}
            {loading ? (
                <p>Cargando...</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {clients.map((client) => (
                            <Card key={client.id} className="flex justify-between items-center" 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 className="font-semibold m-0">{client.name}</h3>
                                    <p className="text-sm text-muted" style={{ color: 'var(--text-muted)' }}>
                                        {client.email && <span>{client.email}</span>}
                                        {client.email && client.phone && <span> • </span>}
                                        {client.phone && <span>{client.phone}</span>}
                                        {!client.email && !client.phone && <span style={{ fontStyle: 'italic' }}>Sin contacto</span>}
                                    </p>
                                </div>
                                <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button variant="secondary" onClick={() => openEditModal(client)}>
                                        <PencilSimple size={18} />
                                    </Button>
                                    <Button variant="danger" onClick={() => handleDelete(client.id)}>
                                        <Trash size={18} />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {clients.length === 0 && (
                            <div className="text-center text-muted p-8">
                                {search ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination.total_pages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '1rem',
                            marginTop: '2rem'
                        }}>
                            <Button
                                variant="secondary"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={!pagination.has_prev}
                            >
                                <CaretLeft size={18} />
                            </Button>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Página {pagination.page} de {pagination.total_pages}
                            </span>
                            <Button
                                variant="secondary"
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={!pagination.has_next}
                            >
                                <CaretRight size={18} />
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} 
                        title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}>
                        
                        {formErrors.submit && (
                            <div style={{ 
                                color: '#ef4444', 
                                marginBottom: '1rem',
                                padding: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '8px'
                            }}>
                                {formErrors.submit}
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Nombre Completo"
                                    required
                                    value={newClient.name}
                                    onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                    style={{
                                        borderColor: formErrors.name ? '#ef4444' : undefined
                                    }}
                                />
                                {formErrors.name && (
                                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                        {formErrors.name}
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={newClient.email}
                                    onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                    style={{
                                        borderColor: formErrors.email ? '#ef4444' : undefined
                                    }}
                                />
                                {formErrors.email && (
                                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                        {formErrors.email}
                                    </div>
                                )}
                            </div>
                            
                            <input
                                type="tel"
                                placeholder="Teléfono"
                                value={newClient.phone}
                                onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                            />
                            
                            <div className="flex justify-end gap-2 mt-4" style={{ 
                                display: 'flex', 
                                justifyContent: 'flex-end', 
                                gap: '0.5rem', 
                                marginTop: '1rem' 
                            }}>
                                <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
                                <Button type="submit">
                                    {editingClient ? 'Guardar Cambios' : 'Crear Cliente'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Clients;
