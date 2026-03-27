import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Services from './pages/Services';
import Subscriptions from './pages/Subscriptions';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Layout para páginas autenticadas
const AuthenticatedLayout = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'var(--bg-dark)',
                color: 'var(--text-muted)'
            }}>
                Cargando...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

// Ruta pública (login) - redirige si ya está autenticado
const PublicRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'var(--bg-dark)',
                color: 'var(--text-muted)'
            }}>
                Cargando...
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
};

const App = () => {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route 
                        path="/login" 
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        } 
                    />
                    <Route 
                        path="/" 
                        element={
                            <AuthenticatedLayout>
                                <Dashboard />
                            </AuthenticatedLayout>
                        } 
                    />
                    <Route 
                        path="/clients" 
                        element={
                            <AuthenticatedLayout>
                                <Clients />
                            </AuthenticatedLayout>
                        } 
                    />
                    <Route 
                        path="/services" 
                        element={
                            <AuthenticatedLayout>
                                <Services />
                            </AuthenticatedLayout>
                        } 
                    />
                    <Route 
                        path="/payments" 
                        element={
                            <AuthenticatedLayout>
                                <Subscriptions />
                            </AuthenticatedLayout>
                        } 
                    />
                    <Route 
                        path="/settings" 
                        element={
                            <AuthenticatedLayout>
                                <Settings />
                            </AuthenticatedLayout>
                        } 
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
};

export default App;
