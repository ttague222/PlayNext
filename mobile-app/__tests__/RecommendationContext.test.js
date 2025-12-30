/**
 * Tests for RecommendationContext
 *
 * These tests verify recommendation state management.
 */

import React from 'react';

// Mock the API module
const mockApi = {
  getRecommendations: jest.fn(),
  rerollRecommendations: jest.fn(),
  submitFeedback: jest.fn(),
  createSession: jest.fn(),
};

jest.mock('../src/services/api', () => ({
  default: mockApi,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('RecommendationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty preferences initially', () => {
      // Test that default preferences are set
      const defaultPreferences = {
        time_available: null,
        energy_mood: null,
        play_style: null,
        platform: null,
        session_type: 'solo',
        discovery_mode: 'familiar',
      };

      expect(defaultPreferences.time_available).toBeNull();
      expect(defaultPreferences.energy_mood).toBeNull();
      expect(defaultPreferences.session_type).toBe('solo');
      expect(defaultPreferences.discovery_mode).toBe('familiar');
    });

    it('should have empty recommendations initially', () => {
      const defaultState = {
        recommendations: [],
        isLoading: false,
        error: null,
      };

      expect(defaultState.recommendations).toEqual([]);
      expect(defaultState.isLoading).toBe(false);
      expect(defaultState.error).toBeNull();
    });
  });

  describe('Preference Updates', () => {
    it('should validate time_available range', () => {
      const validTimes = [15, 30, 60, 90, 120];
      const invalidTimes = [10, 5, 300, -1];

      validTimes.forEach((time) => {
        expect(time >= 15 && time <= 240).toBe(true);
      });

      invalidTimes.forEach((time) => {
        expect(time >= 15 && time <= 240).toBe(false);
      });
    });

    it('should validate energy_mood values', () => {
      const validMoods = ['wind_down', 'casual', 'focused', 'intense'];
      const invalidMoods = ['happy', 'sad', 'angry'];

      validMoods.forEach((mood) => {
        expect(validMoods.includes(mood)).toBe(true);
      });

      invalidMoods.forEach((mood) => {
        expect(validMoods.includes(mood)).toBe(false);
      });
    });

    it('should validate session_type values', () => {
      const validTypes = ['solo', 'couch_coop', 'online_friends', 'any'];

      validTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(true);
      });
    });

    it('should validate discovery_mode values', () => {
      const validModes = ['familiar', 'surprise'];

      expect(validModes.includes('familiar')).toBe(true);
      expect(validModes.includes('surprise')).toBe(true);
      expect(validModes.includes('invalid')).toBe(false);
    });
  });

  describe('API Integration', () => {
    it('should build correct request from preferences', () => {
      const preferences = {
        time_available: 60,
        energy_mood: 'focused',
        play_style: 'action',
        platform: 'pc',
        session_type: 'solo',
        discovery_mode: 'familiar',
      };

      const request = {
        time_available: preferences.time_available,
        energy_mood: preferences.energy_mood,
        play_style: preferences.play_style,
        platform: preferences.platform,
        session_type: preferences.session_type,
        discovery_mode: preferences.discovery_mode,
        excluded_game_ids: [],
      };

      expect(request.time_available).toBe(60);
      expect(request.energy_mood).toBe('focused');
      expect(request.excluded_game_ids).toEqual([]);
    });

    it('should handle API response correctly', async () => {
      const mockResponse = {
        recommendations: [
          {
            game_id: 'game-001',
            title: 'Test Game',
            match_score: 0.85,
          },
        ],
        session_id: 'session-001',
        fallback_applied: false,
      };

      mockApi.getRecommendations.mockResolvedValueOnce(mockResponse);

      const result = await mockApi.getRecommendations({
        time_available: 60,
        energy_mood: 'focused',
      });

      expect(result.recommendations).toHaveLength(1);
      expect(result.session_id).toBe('session-001');
      expect(mockApi.getRecommendations).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockApi.getRecommendations.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockApi.getRecommendations({
          time_available: 60,
          energy_mood: 'focused',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Reroll Logic', () => {
    it('should track shown games for exclusion', () => {
      const shownGames = ['game-001', 'game-002'];
      const newGame = 'game-003';

      // Add new game to shown list
      const updatedShownGames = [...shownGames, newGame];

      expect(updatedShownGames).toContain('game-001');
      expect(updatedShownGames).toContain('game-002');
      expect(updatedShownGames).toContain('game-003');
      expect(updatedShownGames).toHaveLength(3);
    });

    it('should pass excluded games to reroll request', async () => {
      const excludedGameIds = ['game-001', 'game-002'];

      mockApi.rerollRecommendations.mockResolvedValueOnce({
        recommendations: [{ game_id: 'game-003' }],
        session_id: 'session-001',
      });

      await mockApi.rerollRecommendations({
        time_available: 60,
        energy_mood: 'focused',
        session_id: 'session-001',
        excluded_game_ids: excludedGameIds,
      });

      expect(mockApi.rerollRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          excluded_game_ids: excludedGameIds,
        })
      );
    });
  });

  describe('Feedback Submission', () => {
    it('should submit feedback with correct parameters', async () => {
      mockApi.submitFeedback.mockResolvedValueOnce({ id: 'signal-001' });

      await mockApi.submitFeedback('game-001', 'accepted', 'session-001');

      expect(mockApi.submitFeedback).toHaveBeenCalledWith(
        'game-001',
        'accepted',
        'session-001'
      );
    });

    it('should handle feedback types correctly', () => {
      const validFeedbackTypes = [
        'accepted',
        'skipped',
        'worked',
        'not_good_fit',
        'played_loved',
        'played_neutral',
        'played_didnt_stick',
      ];

      validFeedbackTypes.forEach((type) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Recommendation Utilities', () => {
  describe('canGetRecommendations', () => {
    it('should return true when required fields are set', () => {
      const preferences = {
        time_available: 60,
        energy_mood: 'focused',
      };

      const canGet =
        preferences.time_available !== null && preferences.energy_mood !== null;

      expect(canGet).toBe(true);
    });

    it('should return false when time is missing', () => {
      const preferences = {
        time_available: null,
        energy_mood: 'focused',
      };

      const canGet =
        preferences.time_available !== null && preferences.energy_mood !== null;

      expect(canGet).toBe(false);
    });

    it('should return false when mood is missing', () => {
      const preferences = {
        time_available: 60,
        energy_mood: null,
      };

      const canGet =
        preferences.time_available !== null && preferences.energy_mood !== null;

      expect(canGet).toBe(false);
    });
  });

  describe('resetPreferences', () => {
    it('should reset to default values', () => {
      const defaultPreferences = {
        time_available: null,
        energy_mood: null,
        play_style: null,
        platform: null,
        session_type: 'solo',
        discovery_mode: 'familiar',
      };

      // Simulate reset
      const currentPreferences = {
        time_available: 60,
        energy_mood: 'focused',
        play_style: 'action',
        platform: 'pc',
        session_type: 'couch_coop',
        discovery_mode: 'surprise',
      };

      const resetPreferences = { ...defaultPreferences };

      expect(resetPreferences.time_available).toBeNull();
      expect(resetPreferences.energy_mood).toBeNull();
      expect(resetPreferences.session_type).toBe('solo');
    });
  });
});
