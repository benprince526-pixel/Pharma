import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to decode JWT and get user role
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    console.log('Decoded token:', decoded);
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const authService = {
  login: (username, password) => {
    return apiClient.post('/auth/login', { username, password });
  },
  logout: () => {
    localStorage.removeItem('token');
  },
};

export const productService = {
  getAll: () => {
    return apiClient.get('/products');
  },
  getById: (id) => {
    return apiClient.get(`/products/${id}`);
  },
  create: (product) => {
    return apiClient.post('/products', product);
  },
  update: (id, product) => {
    return apiClient.put(`/products/${id}`, product);
  },
  delete: (id) => {
    return apiClient.delete(`/products/${id}`);
  },
};
export const batchService = {
  getAll: () => {
    //console.log('Fetching all batches...');
    return apiClient.get('/batches');
  },
  getById: (id) => {
    return apiClient.get(`/batches/${id}`);
  },
  // batchService.js
create: (batchData) => {
  return apiClient.post('/batches', batchData);
},
  update: (id, batch) => {
    return apiClient.put(`/batches/${id}`, batch);
  },
  delete: (id) => {
    return apiClient.delete(`/batches/${id}`);
  },
  getExpired: (date) => {
  return apiClient.get(`/batches/expired?date=${date}`);
},
clearExpired: (batchId) => apiClient.post(`/batches/clear-expired/${batchId}`),
  archive: (batchId) => apiClient.put(`/batches/${batchId}/archive`),
};

export const stockMovementService = {
  getAll: () => {
    //console.log('Fetching all stock movements...');
    return apiClient.get('/stock-movements'); // Adjust endpoint path if needed
  },
  getById: (id) => {
    return apiClient.get(`/stock-movements/${id}`);
  },
  create: (movementData) => {
    return apiClient.post('/stock-movements', movementData);
  },
  update: (id, movementData) => {
    return apiClient.put(`/stock-movements/${id}`, movementData);
  },
  delete: (id) => {
    return apiClient.delete(`/stock-movements/${id}`);
  }
};

export const userService = {
  register: (username, email, password, role) => {
    return apiClient.post('/auth/register', { username, email, password, role });
  },
  getAllUsers: () => {
    return apiClient.get('/users');
  },
  getUserById: (id) => {
    return apiClient.get(`/users/${id}`);
  },
  updateUser: (id, userData) => {
    return apiClient.put(`/users/${id}`, userData);
  },
  deleteUser: (id) => {
    return apiClient.delete(`/users/${id}`);
  },
export default apiClient;

export { exportWithTemplate, exportToCSV } from './excelService';
