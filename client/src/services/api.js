import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://13.206.121.55:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Doctor API
export const doctorAPI = {
  getAllDoctors: (params) => api.get('/doctors', { params }),
  getDoctorCount: (params) => api.get('/doctors/count', { params }),
  getDoctorById: (id) => api.get(`/doctors/${id}`),
  updateProfile: (data) => api.put('/doctors/profile', data),
  getAppointments: () => api.get('/doctors/appointments'),
  getDashboard: () => api.get('/doctors/dashboard'),
  getPatientCount: () => api.get('/patients/count'),
};

// Appointment API
export const appointmentAPI = {
  create: (data) => api.post('/appointments', data),
  getPatientAppointments: () => api.get('/appointments/patient/list'),
  getUpcoming: () => api.get('/appointments/patient/upcoming'),
  getById: (id) => api.get(`/appointments/${id}`),
  updateStatus: (id, data) => api.put(`/appointments/${id}/status`, data),
  cancel: (id, data) => api.put(`/appointments/${id}/cancel`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
  clearVideoSession: (id) => api.post(`/appointments/${id}/video/clear`),
};

// Assessment API
export const assessmentAPI = {
  create: (data) => api.post('/assessment', data),
  getLatest: () => api.get('/assessment/latest'),
  getHistory: () => api.get('/assessment/history'),
  update: (id, data) => api.put(`/assessment/${id}`, data),
};

// Chat API
export const chatAPI = {
  // id may be either a chatSessionId or an appointmentId; most callers use
  // the appointment-based version so we expose both helpers.
  getSession: (id) => api.get(`/chat/${id}`),
  getSessionByAppointment: (appointmentId) => api.get(`/chat/appointment/${appointmentId}`),
  getMessages: (id) => api.get(`/chat/${id}/messages`),
  endSession: (id) => api.post(`/chat/${id}/end`),
  clearChat: (id) => api.post(`/chat/${id}/clear`),
};

// Patient API
export const patientAPI = {
  getDashboard: () => api.get('/patients/dashboard'),
};

// Contact API
export const contactAPI = {
  create: (data) => api.post('/contact', data),
};

export default api;
