import axios from 'axios';
import { getUploadSession } from './upload-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// Attach token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zoon_token') : null;
  const publicAuthRequest = ['/auth/login', '/auth/register', '/auth/professional-register', '/auth/forgot-password', '/auth/reset-password', '/uploads/presign'].some(path => config.url?.startsWith(path));
  if (token && !publicAuthRequest && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined' && err.config?.headers?.Authorization) {
      const adminToken = localStorage.getItem('zoon_admin_token');
      const requestAuthorization = err.config?.headers?.Authorization;
      if (adminToken && requestAuthorization === `Bearer ${adminToken}`) {
        localStorage.removeItem('zoon_admin_token');
        localStorage.removeItem('zoon_admin_user');
        window.location.href = '/admin';
      } else {
        localStorage.removeItem('zoon_token');
        localStorage.removeItem('zoon_user');
        const professional = window.location.pathname.startsWith('/worker') && !window.location.pathname.startsWith('/workers') || localStorage.getItem('zoon_login_portal') === 'WORKER';
        const returnPath = /^\/(book|bookings)\/[a-zA-Z0-9-]+$/.test(window.location.pathname) ? `?next=${encodeURIComponent(window.location.pathname)}` : '';
        window.location.href = (professional ? '/professional-login' : '/login') + returnPath;
      }
    }
    err.message = getApiError(err, 'We could not complete that. Please try again.');
    if (err.response) err.response.data = { ...err.response.data, message: getApiError(err, 'We could not complete that. Please try again.') };
    return Promise.reject(err);
  }
);

export default api;

export function getApiError(error: any, fallback: string) {
  if (!error?.response) return 'We could not reach zoon. Check your connection and try again.';
  if (error.response.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  const message = error.response?.data?.message;
  return typeof message === 'string' && !/prisma|sql|stack|ECONN|backend|database|AccessDenied|bucket|secret|socket|undefined/i.test(message) ? message : fallback;
}

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string; portal?: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  registerProfessional: (data: any) => api.post('/auth/professional-register', data, { headers: { 'X-Upload-Session': getUploadSession() }, timeout: 120000 }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { email: string; code: string; password: string }) => api.post('/auth/reset-password', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/me', data),
};

// Chat API
export const chatAPI = {
  sendMessage: (message: string, sessionId?: string, safetyAcknowledged = false, signal?: AbortSignal) =>
    api.post('/chat/message', { message, sessionId, safetyAcknowledged }, { signal }),
  createSession: () => api.post('/chat/session'),
  restartSession: (id: string) => api.post(`/chat/session/${id}/restart`),
  stopSession: (id: string, expectedStatus?: string) => api.post(`/chat/session/${id}/stop`, { expectedStatus }),
  getSession: (id: string, signal?: AbortSignal) => api.get(`/chat/session/${id}`, { signal }),
  getSessions: () => api.get('/chat/sessions'),
};

// Request API
export const requestAPI = {
  tracking: (id: string) => api.get(`/requests/${id}/tracking`),
  reschedule: (id: string, scheduledAt: string) => api.post(`/requests/${id}/reschedule`, { scheduledAt }),
  schedule: (id: string, scheduledAt: string) => api.post(`/requests/${id}/schedule`, { scheduledAt }),
  details: (id: string, admin = false) => api.get(`/requests/${id}`, admin ? adminAuth() : {}),
  cancelBooking: (id: string, reason: string, admin = false) => api.post(`/requests/${id}/cancel`, { reason }, admin ? adminAuth() : {}),
  bookAppointment: (data: any) => api.post('/requests/appointments', data),
  getMyRequests: () => api.get('/requests/my'),
  getRequest: (id: string) => api.get(`/requests/${id}`),
  getAllRequests: (params?: any) => api.get('/requests', { params }),
  cancelRequest: (id: string, expectedStatus?: string) => api.post(`/requests/${id}/cancel`, { expectedStatus }),
  sendMessage: (id: string, data: { content?: string; mediaType?: 'IMAGE' | 'AUDIO'; mediaData?: string; fileName?: string }) => api.post(`/requests/${id}/messages`, data),
};

// Worker API
export const workerAPI = {
  updateProfile: (data: any) => api.patch('/workers/profile', data),
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

export const platformAPI = {
  getCategories: () => api.get('/platform/categories'),
  presignUpload: (body: { purpose: string; contentType: string }) => api.post('/uploads/presign', body, { headers: { 'X-Upload-Session': getUploadSession() } }),
  getNotifications: () => api.get('/platform/notifications'),
  markNotificationsRead: () => api.post('/platform/notifications/read'),
  createComplaint: (data: { subject: string; message: string; requestId?: string }) => api.post('/platform/complaints', data),
  submitAppRating: (data: { score: number; comment?: string }) => api.post('/platform/app-ratings', data),
};

export const adminAPI = {
  getOverview: () => api.get('/admin/overview', adminAuth()),
  getWorkerDocument: (id: string) => api.get(`/admin/workers/${id}/document`, adminAuth()),
  rerunWorkerKyc: (id: string) => api.post(`/admin/workers/${id}/kyc/rerun`, undefined, { ...adminAuth(), timeout: 120000 }),
  reviewWorker: (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => api.patch(`/admin/workers/${id}`, { status, note }, adminAuth()),
  reviewCategory: (id: string, status: 'APPROVED' | 'REJECTED') => api.patch(`/admin/categories/${id}`, { status }, adminAuth()),
  updateComplaint: (id: string, status: string, adminNote?: string) => api.patch(`/admin/complaints/${id}`, { status, adminNote }, adminAuth()),
};

function adminAuth() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zoon_admin_token') : null;
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
