import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import { getImageUrl } from '../utils/imageUrl';
import { useAuth } from '../contexts/AuthContext';
import { 
    Gear, 
    Users, 
    Plus, 
    PencilSimple, 
    Trash, 
    Upload,
    Image,
    FloppyDisk,
    X,
    Lock,
    Envelope,
    User,
    CheckCircle,
    XCircle
} from 'phosphor-react';

const Settings = () => {
    const { user: currentUser, isAdmin } = useAuth();
    
    // Settings state
    const [settings, setSettings] = useState({
        app_name: 'Payments Dashboard',
        app_description: '',
        app_logo: null,
        app_favicon: null
    });
    const [originalSettings, setOriginalSettings] = useState({});
    const [logoPreview, setLogoPreview] = useState(null);
    const [faviconPreview, setFaviconPreview] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);
    
    // Users state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user',
        is_active: true
    });
    const [userFormErrors, setUserFormErrors] = useState({});
    
    const [activeTab, setActiveTab] = useState('general');
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        loadSettings();
        loadUsers();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await api.getSettings();
            const settingsMap = response.map || {};
            
            const newSettings = {
                app_name: settingsMap.app_name?.value || 'Payments Dashboard',
                app_description: settingsMap.app_description?.value || '',
                app_logo: settingsMap.app_logo?.value || null,
                app_favicon: settingsMap.app_favicon?.value || null
            };
            
            setSettings(newSettings);
            setOriginalSettings(newSettings);
        } catch (err) {
            console.error('Error loading settings:', err);
        }
    };

    const loadUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await api.getUsers();
            setUsers(response.items || []);
        } catch (err) {
            console.error('Error loading users:', err);
            setError('Error al cargar usuarios');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        
        if (type === 'logo') {
            setLogoPreview(previewUrl);
            setSettings(prev => ({ ...prev, app_logo_file: file }));
        } else {
            setFaviconPreview(previewUrl);
            setSettings(prev => ({ ...prev, app_favicon_file: file }));
        }
    };

    const saveSettings = async () => {
        try {
            setSavingSettings(true);
            setError(null);
            
            const formData = new FormData();
            formData.append('app_name', settings.app_name);
            formData.append('app_description', settings.app_description);
            
            if (settings.app_logo_file) {
                formData.append('app_logo', settings.app_logo_file);
            }
            if (settings.app_favicon_file) {
                formData.append('app_favicon', settings.app_favicon_file);
            }
            
            await api.updateSettings(formData);
            
            setSuccessMessage('Configuración guardada exitosamente');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Reload to get updated URLs
            loadSettings();
            setLogoPreview(null);
            setFaviconPreview(null);
        } catch (err) {
            setError(err.message || 'Error al guardar configuración');
        } finally {
            setSavingSettings(false);
        }
    };

    const validateUserForm = () => {
        const errors = {};
        
        if (!userForm.username.trim()) {
            errors.username = 'El usuario es requerido';
        } else if (userForm.username.length < 3) {
            errors.username = 'Mínimo 3 caracteres';
        }
        
        if (!editingUser && !userForm.password) {
            errors.password = 'La contraseña es requerida para nuevos usuarios';
        } else if (userForm.password && userForm.password.length < 6) {
            errors.password = 'Mínimo 6 caracteres';
        }
        
        if (userForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
            errors.email = 'Email inválido';
        }
        
        setUserFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveUser = async (e) => {
        e.preventDefault();
        
        if (!validateUserForm()) return;
        
        try {
            setError(null);
            
            const data = {
                username: userForm.username.trim(),
                email: userForm.email.trim(),
                role: userForm.role,
                is_active: userForm.is_active
            };
            
            if (editingUser) {
                data.id = editingUser.id;
                if (userForm.password) {
                    data.password = userForm.password;
                }
                await api.updateUser(data);
            } else {
                data.password = userForm.password;
                await api.createUser(data);
            }
            
            setShowUserModal(false);
            resetUserForm();
            loadUsers();
            setSuccessMessage(editingUser ? 'Usuario actualizado' : 'Usuario creado');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err.message || 'Error al guardar usuario');
        }
    };

    const deleteUser = async (userId) => {
        if (userId === currentUser?.id) {
            alert('No puedes eliminar tu propio usuario');
            return;
        }
        
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        
        try {
            await api.deleteUser(userId);
            loadUsers();
            setSuccessMessage('Usuario eliminado');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err.message || 'Error al eliminar usuario');
        }
    };

    const openUserModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setUserForm({
                username: user.username,
                email: user.email || '',
                password: '',
                role: user.role,
                is_active: user.is_active
            });
        } else {
            setEditingUser(null);
            resetUserForm();
        }
        setUserFormErrors({});
        setShowUserModal(true);
    };

    const resetUserForm = () => {
        setUserForm({
            username: '',
            email: '',
            password: '',
            role: 'user',
            is_active: true
        });
    };

    const closeUserModal = () => {
        setShowUserModal(false);
        resetUserForm();
        setEditingUser(null);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Configuración</h1>

            {/* Messages */}
            {error && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#ef4444'
                }}>
                    {error}
                </div>
            )}
            
            {successMessage && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '12px',
                    color: '#22c55e'
                }}>
                    {successMessage}
                </div>
            )}

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                borderBottom: '2px solid rgba(255,255,255,0.05)'
            }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: activeTab === 'general' ? 'var(--primary)' : 'transparent',
                        border: 'none',
                        borderRadius: '8px 8px 0 0',
                        color: activeTab === 'general' ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'general' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Gear size={18} />
                    General
                </button>
                
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: activeTab === 'users' ? 'var(--primary)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px 8px 0 0',
                            color: activeTab === 'users' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'users' ? '600' : '400',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Users size={18} />
                        Usuarios
                    </button>
                )}
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && (
                <Card title="Configuración General">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* App Name */}
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'var(--text-muted)'
                            }}>
                                Nombre del Proyecto
                            </label>
                            <input
                                type="text"
                                value={settings.app_name}
                                onChange={(e) => handleSettingChange('app_name', e.target.value)}
                                placeholder="Payments Dashboard"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'var(--text-muted)'
                            }}>
                                Descripción
                            </label>
                            <textarea
                                value={settings.app_description}
                                onChange={(e) => handleSettingChange('app_description', e.target.value)}
                                placeholder="Descripción del proyecto..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Logo Upload */}
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'var(--text-muted)'
                            }}>
                                Logo
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {(logoPreview || settings.app_logo) && (
                                    <img
                                        src={logoPreview || getImageUrl(settings.app_logo)}
                                        alt="Logo"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'contain',
                                            borderRadius: '12px',
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    />
                                )}
                                <label style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    border: '1px dashed var(--primary)',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: 'var(--primary)'
                                }}>
                                    <Upload size={18} />
                                    {settings.app_logo || logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'logo')}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Tamaño recomendado: 200x60px. Máximo 2MB.
                            </p>
                        </div>

                        {/* Favicon Upload */}
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'var(--text-muted)'
                            }}>
                                Favicon
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {(faviconPreview || settings.app_favicon) && (
                                    <img
                                        src={faviconPreview || settings.app_favicon}
                                        alt="Favicon"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            objectFit: 'contain',
                                            borderRadius: '4px',
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    />
                                )}
                                <label style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    border: '1px dashed var(--primary)',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: 'var(--primary)'
                                }}>
                                    <Image size={18} />
                                    {settings.app_favicon || faviconPreview ? 'Cambiar Favicon' : 'Subir Favicon'}
                                    <input
                                        type="file"
                                        accept="image/*,.ico"
                                        onChange={(e) => handleFileChange(e, 'favicon')}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Formato: .ico, .png. Tamaño recomendado: 32x32px.
                            </p>
                        </div>

                        {/* Save Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <Button onClick={saveSettings} disabled={savingSettings}>
                                <FloppyDisk size={18} />
                                {savingSettings ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && isAdmin && (
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.5rem'
                    }}>
                        <h2 style={{ margin: 0 }}>Gestión de Usuarios</h2>
                        <Button onClick={() => openUserModal()}>
                            <Plus size={18} />
                            Nuevo Usuario
                        </Button>
                    </div>

                    {loadingUsers ? (
                        <p>Cargando usuarios...</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {users.map((user) => (
                                <Card key={user.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: user.role === 'admin' 
                                                ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                                                : 'rgba(255,255,255,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <User size={20} color="white" />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <h3 style={{ margin: 0, fontSize: '1rem' }}>{user.username}</h3>
                                                {user.role === 'admin' && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.15rem 0.5rem',
                                                        background: 'var(--primary)',
                                                        borderRadius: '4px',
                                                        color: 'white'
                                                    }}>
                                                        Admin
                                                    </span>
                                                )}
                                                {!user.is_active && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.15rem 0.5rem',
                                                        background: '#ef4444',
                                                        borderRadius: '4px',
                                                        color: 'white'
                                                    }}>
                                                        Inactivo
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                {user.email || 'Sin email'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <Button variant="secondary" onClick={() => openUserModal(user)}>
                                            <PencilSimple size={16} />
                                        </Button>
                                        {user.id !== currentUser?.id && (
                                            <Button variant="danger" onClick={() => deleteUser(user.id)}>
                                                <Trash size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <Card style={{ width: '100%', maxWidth: '450px' }} 
                        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}>
                        
                        <form onSubmit={saveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    Usuario *
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{
                                        position: 'absolute',
                                        left: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)'
                                    }} />
                                    <input
                                        type="text"
                                        value={userForm.username}
                                        onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                                        placeholder="username"
                                        disabled={!!editingUser}
                                        style={{ paddingLeft: '2.5rem' }}
                                    />
                                </div>
                                {userFormErrors.username && (
                                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                        {userFormErrors.username}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    Email
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Envelope size={18} style={{
                                        position: 'absolute',
                                        left: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)'
                                    }} />
                                    <input
                                        type="email"
                                        value={userForm.email}
                                        onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                                        placeholder="usuario@ejemplo.com"
                                        style={{ paddingLeft: '2.5rem' }}
                                    />
                                </div>
                                {userFormErrors.email && (
                                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                        {userFormErrors.email}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    Contraseña {editingUser && '(dejar en blanco para no cambiar)'}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{
                                        position: 'absolute',
                                        left: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)'
                                    }} />
                                    <input
                                        type="password"
                                        value={userForm.password}
                                        onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                                        placeholder="••••••••"
                                        style={{ paddingLeft: '2.5rem' }}
                                    />
                                </div>
                                {userFormErrors.password && (
                                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                        {userFormErrors.password}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    Rol
                                </label>
                                <select
                                    value={userForm.role}
                                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                                >
                                    <option value="user">Usuario</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            {editingUser && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderRadius: '8px'
                                }}>
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={userForm.is_active}
                                        onChange={(e) => setUserForm({...userForm, is_active: e.target.checked})}
                                    />
                                    <label htmlFor="is_active" style={{ margin: 0, cursor: 'pointer' }}>
                                        Usuario activo
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <Button variant="secondary" type="button" onClick={closeUserModal}>
                                    <X size={16} />
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    <FloppyDisk size={16} />
                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Settings;
