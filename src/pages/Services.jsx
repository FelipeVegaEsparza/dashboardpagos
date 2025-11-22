import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { Plus, Package, PencilSimple, Trash } from 'phosphor-react';

const Services = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newService, setNewService] = useState({ name: '', description: '', image_file: null });
    const [newProduct, setNewProduct] = useState({ name: '', price: '', billing_cycle: 'monthly' });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const data = await api.get('/services.php');
            const servicesWithProducts = await Promise.all(data.map(async (service) => {
                const products = await api.get(`/products.php?service_id=${service.id}`);
                return { ...service, products };
            }));
            setServices(servicesWithProducts);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateService = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newService.name);
            formData.append('description', newService.description);
            if (newService.image_file) {
                formData.append('image', newService.image_file);
            }

            if (isEditing) {
                formData.append('id', selectedService.id);
            }

            await api.post('/services.php', formData);

            setShowServiceModal(false);
            setNewService({ name: '', description: '', image_file: null });
            setIsEditing(false);
            setSelectedService(null);
            fetchServices();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteService = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este servicio? Se eliminarán también sus productos.')) {
            try {
                await api.delete(`/services.php?id=${id}`);
                fetchServices();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const openEditModal = (service) => {
        setSelectedService(service);
        setNewService({ name: service.name, description: service.description, image_file: null });
        setIsEditing(true);
        setShowServiceModal(true);
    };

    const openNewServiceModal = () => {
        setSelectedService(null);
        setNewService({ name: '', description: '', image_file: null });
        setIsEditing(false);
        setShowServiceModal(true);
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        try {
            await api.post('/products.php', { ...newProduct, service_id: selectedService.id });
            setShowProductModal(false);
            setNewProduct({ name: '', price: '', billing_cycle: 'monthly' });
            fetchServices();
        } catch (error) {
            console.error(error);
        }
    };

    const openProductModal = (service) => {
        setSelectedService(service);
        setShowProductModal(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="m-0">Servicios</h1>
                <Button onClick={openNewServiceModal}>
                    <Plus size={20} /> Nuevo Servicio
                </Button>
            </div>

            {loading ? (
                <p>Cargando...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {services.map((service) => (
                        <Card key={service.id} style={{
                            padding: 0,
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            cursor: 'default'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '';
                            }}
                        >
                            {service.image_url && (
                                <img
                                    src={service.image_url}
                                    alt={service.name}
                                    style={{
                                        width: '100%',
                                        height: '180px',
                                        objectFit: 'cover',
                                        display: 'block'
                                    }}
                                />
                            )}
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            margin: '0 0 0.5rem 0',
                                            fontSize: '1.25rem',
                                            fontWeight: '600',
                                            color: 'var(--text-main)'
                                        }}>
                                            {service.name}
                                        </h3>
                                        <p style={{
                                            color: 'var(--text-muted)',
                                            margin: 0,
                                            fontSize: '0.875rem',
                                            lineHeight: '1.5'
                                        }}>
                                            {service.description}
                                        </p>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        marginLeft: '1rem'
                                    }}>
                                        <button
                                            onClick={() => openEditModal(service)}
                                            style={{
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                borderRadius: '8px',
                                                padding: '0.5rem',
                                                color: 'var(--primary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                            }}
                                        >
                                            <PencilSimple size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteService(service.id)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '8px',
                                                padding: '0.5rem',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                e.currentTarget.style.borderColor = '#ef4444';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                                            }}
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    paddingTop: '1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <h4 style={{
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: 'var(--text-muted)',
                                            margin: 0
                                        }}>
                                            Productos
                                        </h4>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--primary)',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontWeight: '500'
                                        }}>
                                            {service.products?.length || 0}
                                        </span>
                                    </div>
                                    {service.products && service.products.length > 0 ? (
                                        <ul style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem',
                                            margin: 0,
                                            padding: 0,
                                            listStyle: 'none'
                                        }}>
                                            {service.products.map(product => (
                                                <li
                                                    key={product.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.75rem',
                                                        background: 'rgba(15, 23, 42, 0.4)',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.875rem',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
                                                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                                    }}
                                                >
                                                    <span style={{ color: 'var(--text-main)' }}>{product.name}</span>
                                                    <span style={{
                                                        fontWeight: '600',
                                                        color: 'var(--primary)',
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        {formatCurrency(product.price)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{
                                            fontSize: '0.875rem',
                                            color: 'var(--text-muted)',
                                            fontStyle: 'italic',
                                            margin: 0,
                                            textAlign: 'center',
                                            padding: '1rem 0'
                                        }}>
                                            Sin productos
                                        </p>
                                    )}
                                </div>

                                <Button
                                    variant="secondary"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        marginTop: '0.5rem'
                                    }}
                                    onClick={() => openProductModal(service)}
                                >
                                    <Plus size={16} /> Agregar Producto
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {services.length === 0 && (
                        <div className="col-span-full text-center text-muted p-8">
                            No hay servicios registrados.
                        </div>
                    )}
                </div>
            )}

            {/* Modal Nuevo/Editar Servicio */}
            {showServiceModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title={isEditing ? "Editar Servicio" : "Nuevo Servicio"}>
                        <form onSubmit={handleCreateService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text" placeholder="Nombre del Servicio" required
                                value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })}
                            />
                            <div className="mb-2">
                                <label className="text-sm text-muted mb-1 block">Imagen del Servicio (Opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => setNewService({ ...newService, image_file: e.target.files[0] })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                                />
                            </div>
                            <textarea
                                placeholder="Descripción"
                                value={newService.description} onChange={e => setNewService({ ...newService, description: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
                            />
                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowServiceModal(false)}>Cancelar</Button>
                                <Button type="submit">Guardar</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Modal Nuevo Producto */}
            {showProductModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title={`Nuevo Producto para ${selectedService?.name}`}>
                        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text" placeholder="Nombre del Producto (ej. Plan Básico)" required
                                value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                            />
                            <input
                                type="number" placeholder="Precio" required
                                value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                            />
                            <select
                                value={newProduct.billing_cycle} onChange={e => setNewProduct({ ...newProduct, billing_cycle: e.target.value })}
                            >
                                <option value="monthly">Mensual</option>
                                <option value="yearly">Anual</option>
                            </select>
                            <div className="flex justify-end gap-2 mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowProductModal(false)}>Cancelar</Button>
                                <Button type="submit">Guardar</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Services;
