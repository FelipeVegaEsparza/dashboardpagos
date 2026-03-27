import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Token storage keys
const TOKEN_KEY = 'payments_dashboard_token';
const REFRESH_TOKEN_KEY = 'payments_dashboard_refresh_token';
const USER_KEY = 'payments_dashboard_user';

// Token expiration buffer (refresh 1 minute before expiry)
const TOKEN_REFRESH_BUFFER = 60 * 1000;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state from storage
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem(TOKEN_KEY);
            const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            const savedUser = localStorage.getItem(USER_KEY);

            if (token && savedUser) {
                try {
                    // Set token first so API calls work
                    api.setAuthToken(token);
                    
                    // Verify token is still valid
                    const response = await api.verifyToken(token);
                    
                    if (response.valid) {
                        setUser(JSON.parse(savedUser));
                        setIsAuthenticated(true);
                        
                        // Schedule token refresh
                        scheduleTokenRefresh(token);
                    } else {
                        // Try to refresh
                        if (refreshToken) {
                            await refreshAccessToken(refreshToken);
                        } else {
                            clearAuth();
                        }
                    }
                } catch (error) {
                    console.error('Auth initialization error:', error);
                    // Try refresh on error
                    if (refreshToken) {
                        try {
                            await refreshAccessToken(refreshToken);
                        } catch {
                            clearAuth();
                        }
                    } else {
                        clearAuth();
                    }
                }
            }
            
            // Always finish loading, even on error
            setIsLoading(false);
        };

        initAuth();
    }, []);

    // Schedule automatic token refresh
    const scheduleTokenRefresh = useCallback((token) => {
        try {
            // Decode token to get expiry
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiryTime = payload.exp * 1000;
            const now = Date.now();
            const timeUntilRefresh = expiryTime - now - TOKEN_REFRESH_BUFFER;

            if (timeUntilRefresh > 0) {
                setTimeout(() => {
                    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
                    if (refreshToken) {
                        refreshAccessToken(refreshToken);
                    }
                }, timeUntilRefresh);
            }
        } catch (error) {
            console.error('Error scheduling token refresh:', error);
        }
    }, []);

    // Refresh access token
    const refreshAccessToken = async (refreshToken) => {
        try {
            const response = await api.refreshToken(refreshToken);
            
            if (response.success) {
                localStorage.setItem(TOKEN_KEY, response.access_token);
                localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
                api.setAuthToken(response.access_token);
                scheduleTokenRefresh(response.access_token);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            clearAuth();
            throw error;
        }
    };

    // Clear auth state
    const clearAuth = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        
        setUser(null);
        setIsAuthenticated(false);
        api.setAuthToken(null);
    };

    // Login function
    const login = async (username, password) => {
        try {
            const response = await api.login(username, password);
            
            if (response.success) {
                // Save to localStorage first
                localStorage.setItem(TOKEN_KEY, response.access_token);
                localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
                localStorage.setItem(USER_KEY, JSON.stringify(response.user));
                
                // Set token in API service before updating state
                api.setAuthToken(response.access_token);
                
                // Update React state
                setUser(response.user);
                setIsAuthenticated(true);
                
                // Schedule token refresh
                scheduleTokenRefresh(response.access_token);
                
                return { success: true };
            } else {
                return { 
                    success: false, 
                    error: response.error || 'Login failed' 
                };
            }
        } catch (error) {
            return { 
                success: false, 
                error: error.message || 'Error de conexión con el servidor. Verifica que el servicio esté disponible.' 
            };
        }
    };

    // Logout function
    const logout = async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        
        try {
            if (refreshToken) {
                await api.logout(refreshToken);
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearAuth();
        }
    };

    // Check if user has specific role
    const hasRole = useCallback((role) => {
        return user?.role === role;
    }, [user]);

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        hasRole,
        isAdmin: hasRole('admin'),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook for using auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Protected Route wrapper component
export const ProtectedRoute = ({ children, requireAdmin = false }) => {
    const { isAuthenticated, isLoading, isAdmin } = useAuth();

    // Wait for auth check to complete
    if (isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: 'var(--bg-dark)',
                color: 'var(--text-main)'
            }}>
                <div>Loading...</div>
            </div>
        );
    }

    // Only redirect after loading is complete and user is not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    // Render Outlet for nested routes, or children if provided
    return children ? children : <Outlet />;
};
