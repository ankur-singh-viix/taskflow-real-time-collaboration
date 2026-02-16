import axios from 'axios';

/**
 * IMPORTANT:
 * In Render:
 * REACT_APP_API_URL = https://taskflow-backend-k4ci.onrender.com
 * (NO /api at the end)
 */

const BASE_URL =
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* =========================
   Attach JWT token safely
========================= */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  // Prevent "undefined" token bug
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* =========================
   Global 401 handler
========================= */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/* =========================
   Auth APIs
========================= */
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

/* =========================
   Boards APIs
========================= */
export const boardsAPI = {
  list: () => api.get('/boards'),
  get: (id) => api.get(`/boards/${id}`),
  create: (data) => api.post('/boards', data),
  update: (id, data) => api.put(`/boards/${id}`, data),
  delete: (id) => api.delete(`/boards/${id}`),
  addMember: (id, email) =>
    api.post(`/boards/${id}/members`, { email }),
  getActivity: (id, page = 1) =>
    api.get(`/boards/${id}/activity`, {
      params: { page, limit: 20 },
    }),
};

/* =========================
   Lists APIs
========================= */
export const listsAPI = {
  create: (boardId, data) =>
    api.post(`/boards/${boardId}/lists`, data),

  update: (boardId, listId, data) =>
    api.put(`/boards/${boardId}/lists/${listId}`, data),

  delete: (boardId, listId) =>
    api.delete(`/boards/${boardId}/lists/${listId}`),

  reorder: (boardId, lists) =>
    api.put(`/boards/${boardId}/lists/reorder`, { lists }),
};

/* =========================
   Tasks APIs
========================= */
export const tasksAPI = {
  list: (boardId, params = {}) =>
    api.get(`/boards/${boardId}/tasks`, { params }),

  get: (boardId, taskId) =>
    api.get(`/boards/${boardId}/tasks/${taskId}`),

  create: (boardId, data) =>
    api.post(`/boards/${boardId}/tasks`, data),

  update: (boardId, taskId, data) =>
    api.put(`/boards/${boardId}/tasks/${taskId}`, data),

  delete: (boardId, taskId) =>
    api.delete(`/boards/${boardId}/tasks/${taskId}`),

  move: (boardId, data) =>
    api.put(`/boards/${boardId}/tasks/move`, data),

  assign: (boardId, taskId, userId) =>
    api.post(`/boards/${boardId}/tasks/${taskId}/assign`, {
      userId,
    }),

  unassign: (boardId, taskId, userId) =>
    api.delete(
      `/boards/${boardId}/tasks/${taskId}/assign/${userId}`
    ),
};

export default api;