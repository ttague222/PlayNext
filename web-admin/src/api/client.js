/**
 * PlayNext API Client (Web Admin)
 *
 * Axios client with Firebase authentication.
 */

import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth error
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Admin API methods
 */
const api = {
  // Games
  getGames: (params) => apiClient.get('/games', { params }),
  getGame: (gameId) => apiClient.get(`/games/${gameId}`),
  createGame: (game) => apiClient.post('/games', game),
  updateGame: (gameId, updates) => apiClient.put(`/games/${gameId}`, updates),
  deleteGame: (gameId) => apiClient.delete(`/games/${gameId}`),
  getCatalogStats: () => apiClient.get('/games/stats'),

  // Signals / Analytics
  getGameSignals: (gameId) => apiClient.get(`/signals/game/${gameId}`),

  // Health
  healthCheck: () => apiClient.get('/health'),
  detailedHealthCheck: () => apiClient.get('/health/detailed'),
};

export default api;
export { apiClient };
