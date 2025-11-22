import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, Users, Package, CreditCard } from 'phosphor-react';

const Sidebar = () => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/', icon: <House size={20} />, label: 'Dashboard' },
        { path: '/clients', icon: <Users size={20} />, label: 'Clientes' },
        { path: '/services', icon: <Package size={20} />, label: 'Servicios' },
        { path: '/payments', icon: <CreditCard size={20} />, label: 'Pagos' },
    ];

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
            <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <img
                    src="/img/logo.webp"
                    alt="Logo"
                    style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '40px',
                        objectFit: 'contain'
                    }}
                />
            </div>

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
                                    background: isActive(item.path) ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)' : 'transparent',
                                    border: isActive(item.path) ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
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

            <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px'
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))'
                    }} />
                    <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>Admin User</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Pro Plan</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
