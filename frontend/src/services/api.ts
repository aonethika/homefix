import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

// Attach token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('homefix_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('homefix_token');
      localStorage.removeItem('homefix_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/me', data),
};

// Chat API
export const chatAPI = {
  sendMessage: (message: string, sessionId?: string) =>
    api.post('/chat/message', { message, sessionId }),
  createSession: () => api.post('/chat/session'),
  getSession: (id: string) => api.get(`/chat/session/${id}`),
  getSessions: () => api.get('/chat/sessions'),
};

// Request API
export const requestAPI = {
  getMyRequests: () => api.get('/requests/my'),
  getRequest: (id: string) => api.get(`/requests/${id}`),
  getAllRequests: (params?: any) => api.get('/requests', { params }),
  cancelRequest: (id: string) => api.post(`/requests/${id}/cancel`),
};

// Worker API
export const workerAPI = {
  getAll: (params?: any) => api.get('/workers', { params }),
  toggleAvailability: () => api.post('/workers/availability'),
  updateLocation: (data: any) => api.patch('/workers/location', data),
  getMyRequests: () => api.get('/workers/requests'),
  getStats: () => api.get('/workers/stats'),
  acceptRequest: (id: string) => api.post(`/workers/requests/${id}/accept`),
  rejectRequest: (id: string) => api.post(`/workers/requests/${id}/reject`),
  updateStatus: (id: string, status: string) => api.patch(`/workers/requests/${id}/status`, { status }),
  setPrice: (id: string, price: number) => api.post(`/workers/requests/${id}/price`, { price }),
};

// Payment API
export const paymentAPI = {
  createOrder: (requestId: string) => api.post('/payments/create-order', { requestId }),
  verifyPayment: (data: any) => api.post('/payments/verify', data),
  getPayment: (requestId: string) => api.get(`/payments/${requestId}`),
};

// Rating API
export const ratingAPI = {
  submit: (data: { requestId: string; score: number; comment?: string }) =>
    api.post('/ratings', data),
  getWorkerRatings: (workerId: string) => api.get(`/ratings/worker/${workerId}`),
};
