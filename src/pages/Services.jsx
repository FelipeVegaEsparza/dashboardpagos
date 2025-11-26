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
    const [activeTab, setActiveTab] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
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
            if (servicesWithProducts.length > 0 && activeTab >= servicesWithProducts.length) {
                setActiveTab(0);
            }
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
            if (isEditingProduct) {
                await api.put('/products.php', { ...newProduct, id: newProduct.id });
            } else {
                await api.post('/products.php', { ...newProduct, service_id: services[activeTab].id });
            }
            setShowProductModal(false);
            setNewProduct({ name: '', price: '', billing_cycle: 'monthly' });
            setIsEditingProduct(false);
            fetchServices();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            try {
                await api.delete(`/products.php?id=${productId}`);
                fetchServices();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const openProductModal = () => {
        setNewProduct({ name: '', price: '', billing_cycle: 'monthly' });
        setIsEditingProduct(false);
        setShowProductModal(true);
    };

    const openEditProductModal = (product) => {
        setNewProduct({ ...product });
        setIsEditingProduct(true);
        setShowProductModal(true);
    };

    const currentService = services[activeTab];

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
            ) : services.length === 0 ? (
                <div className="col-span-full text-center text-muted p-8">
                    No hay servicios registrados.
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        borderBottom: '2px solid rgba(255,255,255,0.05)',
                        overflowX: 'auto',
                        paddingBottom: '0.5rem'
                    }}>
                        {services.map((service, index) => (
                            <button
                                key={service.id}
                                onClick={() => setActiveTab(index)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: activeTab === index ? 'var(--primary)' : 'rgba(15, 23, 42, 0.4)',
                                    border: activeTab === index ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '8px 8px 0 0',
                                    color: activeTab === index ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    fontWeight: activeTab === index ? '600' : '400',
                                    fontSize: '0.875rem',
                                    whiteSpace: 'nowrap',
                                    borderBottom: 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== index) {
                                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
                                        e.currentTarget.style.color = 'var(--text-main)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== index) {
                                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                    }
                                }}
                            >
                                {service.name}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {currentService && (
                        <Card style={{ padding: '2rem' }}>
                            {/* Service Header */}
                            <div style={{
                                display: 'flex',
                                gap: '2rem',
                                marginBottom: '2rem',
                                paddingBottom: '2rem',
                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                {currentService.image_url && (
                                    <img
                                        src={currentService.image_url}
                                        alt={currentService.name}
                                        style={{
                                            width: '200px',
                                            height: '200px',
                                            objectFit: 'cover',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    />
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: '600' }}>
                                                {currentService.name}
                                            </h2>
                                            <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
                                                {currentService.description}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => openEditModal(currentService)}
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
                                                onClick={() => handleDeleteService(currentService.id)}
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
                                </div>
                            </div>

                            {/* Products Section */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                                        Productos
                                        <span style={{
                                            marginLeft: '0.75rem',
                                            fontSize: '0.875rem',
                                            color: 'var(--primary)',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '6px',
                                            fontWeight: '500'
                                        }}>
                                            {currentService.products?.length || 0}
                                        </span>
                                    </h3>
                                    <Button onClick={openProductModal}>
                                        <Plus size={16} /> Agregar Producto
                                    </Button>
                                </div>

                                {currentService.products && currentService.products.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        {currentService.products.map(product => (
                                            <div
                                                key={product.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '1.25rem',
                                                    background: 'rgba(15, 23, 42, 0.4)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '12px',
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
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '500' }}>
                                                        {product.name}
                                                    </h4>
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                        {product.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <span style={{
                                                        fontWeight: '600',
                                                        color: 'var(--primary)',
                                                        fontSize: '1.25rem'
                                                    }}>
                                                        {formatCurrency(product.price)}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => openEditProductModal(product)}
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
                                                            <PencilSimple size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProduct(product.id)}
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
                                                            <Trash size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{
                                        fontSize: '0.875rem',
                                        color: 'var(--text-muted)',
                                        fontStyle: 'italic',
                                        margin: 0,
                                        textAlign: 'center',
                                        padding: '3rem 0'
                                    }}>
                                        Sin productos
                                    </p>
                                )}
                            </div>
                        </Card>
                    )}
                </>
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

            {/* Modal Nuevo/Editar Producto */}
            {showProductModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <Card className="w-full max-w-md" style={{ width: '100%', maxWidth: '500px' }} title={isEditingProduct ? "Editar Producto" : `Nuevo Producto para ${currentService?.name}`}>
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
