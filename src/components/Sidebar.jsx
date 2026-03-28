import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { House, Users, Package, CreditCard, SignOut, User, Gear, ListChecks } from 'phosphor-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/', icon: <House size={20} />, label: 'Dashboard' },
        { path: '/clients', icon: <Users size={20} />, label: 'Clientes' },
        { path: '/services', icon: <Package size={20} />, label: 'Servicios' },
        { path: '/subscriptions', icon: <ListChecks size={20} />, label: 'Suscripciones' },
        { path: '/payments', icon: <CreditCard size={20} />, label: 'Pagos' },
        { path: '/settings', icon: <Gear size={20} />, label: 'Configuración' },
    ];

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <aside className="glass" style={{
            width: '280px',
            height: '95vh',
            margin: '2.5vh 0 2.5vh 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: '2.5vh',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)'
        }}>
            {/* Logo */}
            <div style={{ 
                padding: '2rem', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center'
            }}>
                <img
                    src="/img/logo.webp"
                    alt="Logo"
                    style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '40px',
                        objectFit: 'contain'
                    }}
                    onError={(e) => {
                        // Fallback if logo doesn't load
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
                <div style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '1.25rem'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <CreditCard size={18} color="white" />
                    </div>
                    Payments
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '1.5rem 1rem' }}>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem 1.25rem',
                                    borderRadius: '12px',
                                    color: isActive(item.path) ? 'white' : 'var(--text-muted)',
                                    background: isActive(item.path) 
                                        ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)' 
                                        : 'transparent',
                                    border: isActive(item.path) 
                                        ? '1px solid rgba(99, 102, 241, 0.2)' 
                                        : '1px solid transparent',
                                    fontWeight: isActive(item.path) ? '500' : '400',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <span style={{ color: isActive(item.path) ? 'var(--primary)' : 'inherit' }}>
                                    {item.icon}
                                </span>
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User Profile & Logout */}
            <div style={{ 
                padding: '1.5rem', 
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {/* User Info */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px'
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <User size={18} color="white" weight="fill" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: '500', 
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'white'
                        }}>
                            {user?.username || 'User'}
                        </p>
                        <p style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-muted)', 
                            margin: 0,
                            textTransform: 'capitalize'
                        }}>
                            {user?.role || 'User'} • {user?.email || ''}
                        </p>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isLoggingOut ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                        if (!isLoggingOut) {
                            e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.target.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    }}
                >
                    <SignOut size={18} />
                    {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
