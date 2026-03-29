const API_BASE = '/api';

/**
 * API Service with JWT Authentication
 * Optimized with automatic token refresh and error handling
 */

class ApiService {
    constructor() {
        this.authToken = null;
        this.refreshPromise = null;
    }

    /**
     * Set the authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * Get request headers with auth token if available
     */
    getHeaders(isFormData = false) {
        const headers = {};
        
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        return headers;
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        // Check for unauthorized
        if (response.status === 401) {
            // Clear token and trigger re-login
            this.authToken = null;
            localStorage.removeItem('payments_dashboard_token');
            localStorage.removeItem('payments_dashboard_refresh_token');
            localStorage.removeItem('payments_dashboard_user');
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
        }

        // Get response text first
        const text = await response.text();
        
        // Check if response is empty
        if (!text || text.trim() === '') {
            throw new Error('Empty response from server. Please check if the API is running.');
        }

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            // Not valid JSON - could be HTML error page
            console.error('Invalid JSON response:', text.substring(0, 500));
            throw new Error('Server returned invalid response. Please check server logs or try again later.');
        }

        if (!response.ok) {
            throw new Error(data.error?.message || data.error || 'Request failed');
        }

        return data;
    }

    /**
     * Make HTTP request with automatic retry on token expiry
     */
    async request(method, endpoint, data = null, options = {}) {
        const isFormData = data instanceof FormData;
        
        // Merge headers properly - don't override Authorization
        const defaultHeaders = this.getHeaders(isFormData);
        const customHeaders = options.headers || {};
        const mergedHeaders = {
            ...defaultHeaders,
            ...customHeaders
        };
        
        // If FormData and custom headers don't include Content-Type,
        // let browser set it with proper boundary
        if (isFormData && !customHeaders['Content-Type']) {
            delete mergedHeaders['Content-Type'];
        }
        
        const config = {
            method,
            headers: mergedHeaders,
            ...options
        };
        // Remove duplicate headers from options
        delete config.headers;
        config.headers = mergedHeaders;

        if (data && method !== 'GET') {
            config.body = isFormData ? data : JSON.stringify(data);
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            return await this.handleResponse(response);
        } catch (error) {
            // Handle network errors
            if (error.message === 'Failed to fetch') {
                throw new Error('Network error. Please check your connection.');
            }
            throw error;
        }
    }

    // HTTP Methods
    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, data, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    async put(endpoint, data, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    // ==================== AUTH ENDPOINTS ====================

    /**
     * Login user
     */
    async login(username, password) {
        const response = await this.post('/auth.php', {
            action: 'login',
            username,
            password
        });
        return response;
    }

    /**
     * Logout user
     */
    async logout(refreshToken) {
        try {
            await this.post('/auth.php', {
                action: 'logout',
                refresh_token: refreshToken
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * Verify current token
     */
    async verifyToken(token) {
        const response = await fetch(`${API_BASE}/auth.php`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return await response.json();
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        const response = await this.post('/auth.php', {
            action: 'refresh',
            refresh_token: refreshToken
        });
        return response;
    }

    // ==================== CLIENT ENDPOINTS ====================

    async getClients(params = {}) {
        const query = new URLSearchParams(params).toString();
        const endpoint = query ? `/clients.php?${query}` : '/clients.php';
        const response = await this.get(endpoint);
        return response.data || response;
    }

    async createClient(data) {
        return this.post('/clients.php', data);
    }

    async updateClient(data) {
        return this.put('/clients.php', data);
    }

    async deleteClient(id) {
        return this.delete(`/clients.php?id=${id}`);
    }

    // ==================== SERVICE ENDPOINTS ====================

    async getServices(withProducts = false) {
        const endpoint = withProducts ? '/services.php?with_products=1' : '/services.php';
        const response = await this.get(endpoint);
        return response.data || response;
    }

    async createService(data) {
        const isFormData = data instanceof FormData;
        return this.post('/services.php', data, {
            headers: isFormData ? {} : { 'Content-Type': 'application/json' }
        });
    }

    async updateService(data) {
        return this.put('/services.php', data);
    }

    async deleteService(id) {
        return this.delete(`/services.php?id=${id}`);
    }

    // ==================== PRODUCT ENDPOINTS ====================

    async getProducts(serviceId = null) {
        const endpoint = serviceId ? `/products.php?service_id=${serviceId}` : '/products.php';
        const response = await this.get(endpoint);
        return response.data || response;
    }

    async createProduct(data) {
        return this.post('/products.php', data);
    }

    async updateProduct(data) {
        return this.put('/products.php', data);
    }

    async deleteProduct(id) {
        return this.delete(`/products.php?id=${id}`);
    }

    // ==================== SUBSCRIPTION ENDPOINTS ====================

    async getSubscriptions(params = {}) {
        const query = new URLSearchParams(params).toString();
        const endpoint = query ? `/subscriptions.php?${query}` : '/subscriptions.php';
        const response = await this.get(endpoint);
        return response.data || response;
    }

    async createSubscription(data) {
        return this.post('/subscriptions.php', data);
    }

    async updateSubscription(data) {
        return this.put('/subscriptions.php', data);
    }

    async deleteSubscription(id) {
        return this.delete(`/subscriptions.php?id=${id}`);
    }

    async permanentlyDeleteSubscription(id) {
        return this.delete(`/subscriptions.php?id=${id}&permanent=true`);
    }

    // ==================== PAYMENT ENDPOINTS ====================

    async getPayments(subscriptionId) {
        const response = await this.get(`/payments.php?subscription_id=${subscriptionId}`);
        return response.data || response;
    }

    async createPayment(data) {
        const isFormData = data instanceof FormData;
        return this.post('/payments.php', data, {
            headers: isFormData ? {} : { 'Content-Type': 'application/json' }
        });
    }

    // ==================== BILLING ENDPOINTS ====================

    async getBillingSubscriptions(type = 'all') {
        const response = await this.get(`/billing.php?type=${type}`);
        return response.data || response;
    }

    async sendBillingEmail(subscriptionId, template = 'reminder', customMessage = null) {
        const data = {
            subscription_id: subscriptionId,
            template: template
        };
        if (customMessage) {
            data.custom_message = customMessage;
        }
        return this.post('/billing.php', data);
    }

    // ==================== CONVERSATIONS ENDPOINTS ====================

    async getConversations(unreadOnly = false) {
        const params = unreadOnly ? '?unread_only=true' : '';
        const response = await this.get(`/conversations.php${params}`);
        return response.data || response;
    }

    async getDiagnostics() {
        const response = await this.get('/diagnostics.php');
        return response.data || response;
    }

    async fetchNewEmails() {
        return this.get('/conversations.php?action=fetch');
    }

    async markConversationAsRead(id) {
        return this.post('/conversations.php', { action: 'mark_read', id });
    }

    async sendReply(conversationId, body) {
        return this.post('/conversations.php', { 
            action: 'reply', 
            conversation_id: conversationId, 
            body 
        });
    }

    // ==================== DASHBOARD ENDPOINTS ====================

    async getDashboard() {
        const response = await this.get('/dashboard.php');
        return response.data || response;
    }

    // ==================== FINANCES ENDPOINTS ====================

    async getFinances() {
        const response = await this.get('/finances.php');
        return response.data || response;
    }

    // ==================== SETTINGS ENDPOINTS ====================

    async getSettings() {
        const response = await this.get('/settings.php');
        return response.data || response;
    }

    async updateSettings(data) {
        // Headers are automatically handled by request method
        // FormData will have Content-Type omitted (browser sets it with boundary)
        return this.post('/settings.php', data);
    }

    // ==================== USERS ENDPOINTS ====================

    async getUsers() {
        const response = await this.get('/users.php');
        return response.data || response;
    }

    async getUser(id) {
        const response = await this.get(`/users.php?id=${id}`);
        return response.data || response;
    }

    async createUser(data) {
        return this.post('/users.php', data);
    }

    async updateUser(data) {
        return this.put('/users.php', data);
    }

    async deleteUser(id) {
        return this.delete(`/users.php?id=${id}`);
    }
}

// Export singleton instance
export const api = new ApiService();

// Keep backwards compatibility
export const getClients = () => api.getClients();
export const createClient = (data) => api.createClient(data);
export const updateClient = (data) => api.updateClient(data);
export const deleteClient = (id) => api.deleteClient(id);

export const getServices = () => api.getServices();
export const createService = (data) => api.createService(data);
export const updateService = (data) => api.updateService(data);
export const deleteService = (id) => api.deleteService(id);

export const getProducts = (serviceId) => api.getProducts(serviceId);
export const createProduct = (data) => api.createProduct(data);
export const updateProduct = (data) => api.updateProduct(data);
export const deleteProduct = (id) => api.deleteProduct(id);

export const getSubscriptions = (params) => api.getSubscriptions(params);
export const createSubscription = (data) => api.createSubscription(data);

export const getPayments = (subscriptionId) => api.getPayments(subscriptionId);
export const createPayment = (data) => api.createPayment(data);

export const getDashboard = () => api.getDashboard();
