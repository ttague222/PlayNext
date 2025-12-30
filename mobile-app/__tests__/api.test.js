/**
 * Tests for API Client
 *
 * These tests verify the API client methods and interceptors.
 */

import axios from 'axios';

// Create a proper mock instance that will be returned by axios.create()
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

// Mock axios before importing api
jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

// Mock Firebase auth
jest.mock('../src/config/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBaseUrl: 'http://localhost:8000/api',
    },
  },
}));

describe('API Client', () => {
  let api;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the module to get a fresh instance
    jest.resetModules();

    // Re-setup the mock after resetModules
    jest.doMock('axios', () => ({
      create: jest.fn(() => mockAxiosInstance),
    }));

    // Import fresh api module
    api = require('../src/services/api').default;
  });

  describe('getRecommendations', () => {
    it('should call POST /recommend with params', async () => {
      const mockResponse = {
        data: {
          recommendations: [],
          session_id: 'test-session',
          fallback_applied: false,
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const params = {
        time_available: 60,
        energy_mood: 'focused',
      };

      const result = await api.getRecommendations(params);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/recommend', params);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('rerollRecommendations', () => {
    it('should call POST /recommend/reroll with params', async () => {
      const mockResponse = {
        data: {
          recommendations: [],
          session_id: 'test-session',
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const params = {
        time_available: 30,
        energy_mood: 'casual',
        session_id: 'existing-session',
        excluded_game_ids: ['game-1'],
      };

      const result = await api.rerollRecommendations(params);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/recommend/reroll', params);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getGames', () => {
    it('should call GET /games with default params', async () => {
      const mockResponse = {
        data: { games: [], total: 0 },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.getGames();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/games', {
        params: { limit: 50, offset: 0 },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should call GET /games with platform filter', async () => {
      const mockResponse = {
        data: { games: [], total: 0 },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.getGames(20, 10, 'pc');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/games', {
        params: { limit: 20, offset: 10, platform: 'pc' },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getGame', () => {
    it('should call GET /games/:id', async () => {
      const mockResponse = {
        data: { game_id: 'game-001', title: 'Test Game' },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.getGame('game-001');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/games/game-001');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('submitFeedback', () => {
    it('should call POST /signals/feedback', async () => {
      const mockResponse = {
        data: { id: 'signal-001' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await api.submitFeedback('game-001', 'accepted', 'session-001', { source: 'test' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/signals/feedback', {
        game_id: 'game-001',
        signal_type: 'accepted',
        session_id: 'session-001',
        context: { source: 'test' },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('acceptRecommendation', () => {
    it('should call POST /signals/accept with query params', async () => {
      const mockResponse = {
        data: { message: 'Acceptance recorded' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await api.acceptRecommendation('game-001', 'session-001');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/signals/accept', null, {
        params: { game_id: 'game-001', session_id: 'session-001' },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Signal History Management', () => {
    it('getSignalHistory should call GET /signals/history', async () => {
      const mockResponse = {
        data: [],
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.getSignalHistory(50);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/signals/history', {
        params: { limit: 50 },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('deleteSignal should call DELETE /signals/history/:id', async () => {
      const mockResponse = {
        data: { message: 'Signal deleted' },
      };
      mockAxiosInstance.delete.mockResolvedValueOnce(mockResponse);

      const result = await api.deleteSignal('signal-001');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/signals/history/signal-001');
      expect(result).toEqual(mockResponse.data);
    });

    it('clearSignalHistory should call DELETE /signals/history', async () => {
      const mockResponse = {
        data: { message: 'History cleared', deleted_count: 5 },
      };
      mockAxiosInstance.delete.mockResolvedValueOnce(mockResponse);

      const result = await api.clearSignalHistory();

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/signals/history');
      expect(result).toEqual(mockResponse.data);
    });

    it('updateSignalWorked should call PATCH with worked status', async () => {
      const mockResponse = {
        data: { message: 'Worked status updated' },
      };
      mockAxiosInstance.patch.mockResolvedValueOnce(mockResponse);

      const result = await api.updateSignalWorked('signal-001', true);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/signals/history/signal-001/worked',
        null,
        { params: { worked: true } }
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteUserData', () => {
    it('should call DELETE /signals/user/data', async () => {
      const mockResponse = {
        data: {
          message: 'All user data deleted',
          deleted: { signals: 10, sessions: 2, user: true },
        },
      };
      mockAxiosInstance.delete.mockResolvedValueOnce(mockResponse);

      const result = await api.deleteUserData();

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/signals/user/data');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Session Management', () => {
    it('createSession should call POST /signals/session', async () => {
      const mockResponse = {
        data: { session_id: 'new-session', user_id: null },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await api.createSession();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/signals/session');
      expect(result).toEqual(mockResponse.data);
    });

    it('getSession should call GET /signals/session/:id', async () => {
      const mockResponse = {
        data: { session_id: 'session-001', games_shown: [] },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.getSession('session-001');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/signals/session/session-001');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('healthCheck', () => {
    it('should call GET /health', async () => {
      const mockResponse = {
        data: { status: 'healthy' },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await api.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
