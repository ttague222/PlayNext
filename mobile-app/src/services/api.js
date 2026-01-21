/**
 * PlayNext API Client
 *
 * Axios-based API client with Firebase authentication.
 */

import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from '../config/firebase';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000/api';

// Log API configuration for debugging
console.log('[API] Base URL configured:', API_BASE_URL);

// Create Axios instance
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
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Failed to get auth token - continue without auth
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log detailed error info for debugging
    if (error.response) {
      // Server responded with error status
      console.error('[API Error]', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
        method: error.config?.method,
      });
    } else if (error.request) {
      // Request made but no response received (network error)
      console.error('[API Network Error]', {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
      });
    } else {
      // Error setting up request
      console.error('[API Setup Error]', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * PlayNext API methods
 */
const api = {
  // ============================================
  // Recommendations
  // ============================================

  /**
   * Get game recommendations
   * @param {Object} params - Recommendation parameters
   * @param {number} params.time_available - Available time in minutes
   * @param {string} params.energy_mood - Current mood (wind_down, casual, focused, intense)
   * @param {string} [params.play_style] - Play style filter
   * @param {string} [params.platform] - Platform filter
   * @param {string} [params.session_type] - Session type (solo, couch_coop, online_friends, any)
   * @param {string} [params.discovery_mode] - Discovery mode (familiar, surprise)
   * @param {string} [params.session_id] - Session ID for tracking
   * @param {string[]} [params.excluded_game_ids] - Games to exclude
   */
  getRecommendations: async (params) => {
    const response = await apiClient.post('/recommend', params);
    return response.data;
  },

  /**
   * Reroll recommendations (get new ones)
   */
  rerollRecommendations: async (params) => {
    const response = await apiClient.post('/recommend/reroll', params);
    return response.data;
  },

  // ============================================
  // Games
  // ============================================

  /**
   * Get list of games
   */
  getGames: async (limit = 50, offset = 0, platform = null) => {
    const params = { limit, offset };
    if (platform) params.platform = platform;
    const response = await apiClient.get('/games', { params });
    return response.data;
  },

  /**
   * Get a single game by ID
   */
  getGame: async (gameId) => {
    const response = await apiClient.get(`/games/${gameId}`);
    return response.data;
  },

  /**
   * Get game catalog statistics
   */
  getCatalogStats: async () => {
    const response = await apiClient.get('/games/stats');
    return response.data;
  },

  // ============================================
  // Signals & Feedback
  // ============================================

  /**
   * Submit feedback on a recommendation
   * @param {string} gameId - Game ID
   * @param {string} signalType - Signal type (worked, not_good_fit, played_loved, etc.)
   * @param {string} sessionId - Session ID
   * @param {Object} [context] - Context of the recommendation
   */
  submitFeedback: async (gameId, signalType, sessionId, context = null) => {
    const response = await apiClient.post('/signals/feedback', {
      game_id: gameId,
      signal_type: signalType,
      session_id: sessionId,
      context,
    });
    return response.data;
  },

  /**
   * Record that user accepted a recommendation
   * @param {string} gameId - Game ID
   * @param {string} sessionId - Session ID
   * @param {string} [gameTitle] - Game title for display in history
   */
  acceptRecommendation: async (gameId, sessionId, gameTitle = null) => {
    const params = { game_id: gameId, session_id: sessionId };
    if (gameTitle) {
      params.game_title = gameTitle;
    }
    const response = await apiClient.post('/signals/accept', null, { params });
    return response.data;
  },

  /**
   * Create a new session
   */
  createSession: async () => {
    const response = await apiClient.post('/signals/session');
    return response.data;
  },

  /**
   * Get session information
   */
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/signals/session/${sessionId}`);
    return response.data;
  },

  /**
   * Get user's signal history
   */
  getSignalHistory: async (limit = 50) => {
    const response = await apiClient.get('/signals/history', { params: { limit } });
    return response.data;
  },

  /**
   * Delete a specific signal from history
   * @param {string} signalId - Signal ID to delete
   */
  deleteSignal: async (signalId) => {
    const response = await apiClient.delete(`/signals/history/${signalId}`);
    return response.data;
  },

  /**
   * Clear all signal history
   */
  clearSignalHistory: async () => {
    const response = await apiClient.delete('/signals/history');
    return response.data;
  },

  /**
   * Update the 'worked' status of a signal
   * @param {string} signalId - Signal ID
   * @param {boolean} worked - Whether the recommendation worked
   */
  updateSignalWorked: async (signalId, worked) => {
    const response = await apiClient.patch(`/signals/history/${signalId}/worked`, null, {
      params: { worked },
    });
    return response.data;
  },

  /**
   * Delete all user data (signals, sessions, user document)
   */
  deleteUserData: async () => {
    const response = await apiClient.delete('/signals/user/data');
    return response.data;
  },

  /**
   * Get aggregated signals for a game
   * @param {string} gameId - Game ID
   */
  getGameSignals: async (gameId) => {
    const response = await apiClient.get(`/signals/game/${gameId}`);
    return response.data;
  },

  // ============================================
  // Buckets (Save Collections)
  // ============================================

  /**
   * Get all buckets for the current user
   */
  getBuckets: async () => {
    const response = await apiClient.get('/buckets');
    return response.data;
  },

  /**
   * Get a specific bucket with its games
   * @param {string} bucketType - Bucket type (want_to_play, currently_playing, finished, not_for_me)
   * @param {number} limit - Max games to return
   * @param {number} offset - Pagination offset
   */
  getBucket: async (bucketType, limit = 50, offset = 0) => {
    const response = await apiClient.get(`/buckets/${bucketType}`, {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Add a game to a bucket
   * @param {string} bucketType - Bucket type
   * @param {string} gameId - Game ID
   * @param {string} gameTitle - Game title for display
   * @param {string} [notes] - Optional notes
   */
  addGameToBucket: async (bucketType, gameId, gameTitle, notes = null) => {
    const response = await apiClient.post(`/buckets/${bucketType}/games`, {
      game_id: gameId,
      game_title: gameTitle,
      notes,
    });
    return response.data;
  },

  /**
   * Remove a game from a bucket
   * @param {string} bucketType - Bucket type
   * @param {string} gameId - Game ID
   */
  removeGameFromBucket: async (bucketType, gameId) => {
    const response = await apiClient.delete(`/buckets/${bucketType}/games/${gameId}`);
    return response.data;
  },

  /**
   * Move a game between buckets
   * @param {string} fromBucketType - Source bucket type
   * @param {string} toBucketType - Destination bucket type
   * @param {string} gameId - Game ID
   */
  moveGame: async (fromBucketType, toBucketType, gameId) => {
    const response = await apiClient.post('/buckets/move', {
      from_bucket_type: fromBucketType,
      to_bucket_type: toBucketType,
      game_id: gameId,
    });
    return response.data;
  },

  /**
   * Find which bucket a game is in
   * @param {string} gameId - Game ID
   */
  getGameBucket: async (gameId) => {
    const response = await apiClient.get(`/buckets/game/${gameId}/bucket`);
    return response.data;
  },

  // ============================================
  // Health
  // ============================================

  /**
   * Check API health
   */
  healthCheck: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

export default api;
export { apiClient };
