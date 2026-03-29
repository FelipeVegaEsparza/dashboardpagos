import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Lock, User, Eye, EyeSlash } from 'phosphor-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logoUrl, setLogoUrl] = useState(null);
    const [appName, setAppName] = useState('Bienvenido');
    
    const { login } = useAuth();
    const navigate = useNavigate();

    // Load settings (logo and app name)
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await api.getSettings();
                if (response.app_logo) {
                    setLogoUrl(response.app_logo);
                }
                if (response.app_name) {
                    setAppName(response.app_name);
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!username.trim() || !password.trim()) {
            setError('Ingresa usuario y contraseña');
            setIsLoading(false);
            return;
        }

        try {
            const result = await login(username.trim(), password);
            
            if (result.success) {
                // Navegación directa - el PublicRoute en App.jsx redirigirá si es necesario
                window.location.href = '/';
            } else {
                setError(result.error || 'Credenciales inválidas');
            }
        } catch (err) {
            setError('Error al iniciar sesión. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-dark)',
            backgroundImage: `
                radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(168, 85, 247, 0.08) 0%, transparent 25%)
            `,
            backgroundAttachment: 'fixed',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                padding: '2.5rem',
                background: 'rgba(30, 41, 59, 0.6)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt="Logo" 
                            style={{
                                maxWidth: '200px',
                                maxHeight: '100px',
                                width: 'auto',
                                height: 'auto',
                                margin: '0 auto 1.5rem',
                                objectFit: 'contain',
                                display: 'block'
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div style={{
                        width: '64px',
                        height: '64px',
                        margin: '0 auto 1.5rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: logoUrl ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Lock size={32} color="white" weight="fill" />
                    </div>
                    {!logoUrl && (
                        <h1 style={{
                            fontSize: '1.75rem',
                            fontWeight: '600',
                            color: 'white',
                            marginBottom: '0.5rem'
                        }}>
                            {appName}
                        </h1>
                    )}
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.95rem',
                        marginTop: logoUrl ? '1rem' : '0'
                    }}>
                        Ingresa tus credenciales para continuar
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        color: '#ef4444',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: 'var(--text-muted)'
                        }}>
                            Usuario
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User 
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
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Usuario"
                                disabled={isLoading}
                                autoComplete="username"
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem 0.875rem 3rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: 'var(--text-muted)'
                        }}>
                            Contraseña
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock 
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
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Contraseña"
                                disabled={isLoading}
                                autoComplete="current-password"
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 3rem',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '0.25rem'
                                }}
                            >
                                {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginTop: '0.5rem',
                            background: isLoading 
                                ? 'rgba(99, 102, 241, 0.5)' 
                                : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                {/* Dev hint */}
                {import.meta.env.DEV && (
                    <div style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '12px',
                        textAlign: 'center'
                    }}>
                        <p style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            margin: 0
                        }}>
                            <strong>Dev:</strong> admin / admin123
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
