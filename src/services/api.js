const API_BASE = '/api';

export const api = {
    get: async (endpoint) => {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    },
    post: async (endpoint, data, options = {}) => {
        const isFormData = data instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { ...headers, ...options.headers },
            body: isFormData ? data : JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    },
    put: async (endpoint, data, options = {}) => {
        const isFormData = data instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { ...headers, ...options.headers },
            body: isFormData ? data : JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    },
    delete: async (endpoint) => {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    }
};
