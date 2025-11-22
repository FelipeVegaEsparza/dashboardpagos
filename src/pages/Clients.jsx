import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { Plus, Trash, PencilSimple } from 'phosphor-react';

const Clients = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const data = await api.get('/clients.php');
            setClients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/clients.php', newClient);
            setShowModal(false);
            setNewClient({ name: '', email: '', phone: '' });
            fetchClients();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
            try {
                await api.delete(`/clients.php?id=${id}`);
                fetchClients();
            } catch (error) {
                console.error(error);
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="m-0">Clientes</h1>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={20} /> Nuevo Cliente
                </Button>
            </div>

            {loading ? (
                <p>Cargando...</p>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {clients.map((client) => (
                        <Card key={client.id} className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 className="font-semibold m-0">{client.name}</h3>
                                <p className="text-sm text-muted" style={{ color: 'var(--text-muted)' }}>{client.email} • {client.phone}</p>
                            </div>
                            <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button variant="secondary" onClick={() => { }}><PencilSimple size={18} /></Button>
                                <Button variant="danger" onClick={() => handleDelete(client.id)}><Trash size={18} /></Button>
                            </div>
                        </Card>
                    ))}
                    {clients.length === 0 && (
                        <div className="text-center text-muted p-8">No hay clientes registrados.</div>
                    )}
                </div>
            )}

            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title="Nuevo Cliente">
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text" placeholder="Nombre Completo" required
                                value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                            />
                            <input
                                type="email" placeholder="Email"
                                value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                            />
                            <input
                                type="tel" placeholder="Teléfono"
                                value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                            />
                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                                <Button type="submit">Guardar</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Clients;
