/**
 * PlayNext Recommendation Context
 *
 * Manages recommendation state and user preferences.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const PREFERRED_PLATFORMS_KEY = '@playnxt_preferred_platforms';
const PREFERRED_TIME_KEY = '@playnxt_preferred_time';

const RecommendationContext = createContext({});

export const useRecommendation = () => useContext(RecommendationContext);

// Default values matching PRD
const DEFAULT_PREFERENCES = {
  timeAvailable: null,  // User must select - no default
  energyMood: null,  // User must select - no default
  genres: [],  // Merged play styles + game categories into single genre filter
  platforms: [],   // Now an array for multi-select
  sessionType: 'any',  // Default to any - user can narrow to solo or multiplayer
  discoveryMode: 'familiar',
};

export const RecommendationProvider = ({ children }) => {
  // Current session
  const [sessionId, setSessionId] = useState(null);

  // User preferences for current session
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // Saved preferences (persisted across sessions)
  const [savedPlatforms, setSavedPlatforms] = useState([]);
  const [savedTimeAvailable, setSavedTimeAvailable] = useState(null);

  // Load saved preferences on mount
  useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        const [storedPlatforms, storedTime] = await Promise.all([
          AsyncStorage.getItem(PREFERRED_PLATFORMS_KEY),
          AsyncStorage.getItem(PREFERRED_TIME_KEY),
        ]);

        const updates = {};

        if (storedPlatforms) {
          const platforms = JSON.parse(storedPlatforms);
          setSavedPlatforms(platforms);
          updates.platforms = platforms;
        }

        if (storedTime) {
          const timeAvailable = JSON.parse(storedTime);
          setSavedTimeAvailable(timeAvailable);
          updates.timeAvailable = timeAvailable;
        }

        if (Object.keys(updates).length > 0) {
          setPreferences((prev) => ({ ...prev, ...updates }));
        }
      } catch (err) {
        console.warn('[RecommendationContext] Failed to load saved preferences:', err);
      }
    };
    loadSavedPreferences();
  }, []);

  // Recommendations
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Shown games (for excluding in rerolls)
  const [shownGameIds, setShownGameIds] = useState([]);

  // Fallback info
  const [fallbackApplied, setFallbackApplied] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState(null);

  // History update counter - increment when signals are recorded
  // HistoryScreen watches this to know when to refresh
  const [historyVersion, setHistoryVersion] = useState(0);

  /**
   * Update a single preference
   * For platforms and timeAvailable, also persist to AsyncStorage for future sessions
   */
  const updatePreference = useCallback(async (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));

    // Persist certain preferences for future sessions
    try {
      if (key === 'platforms') {
        await AsyncStorage.setItem(PREFERRED_PLATFORMS_KEY, JSON.stringify(value));
        setSavedPlatforms(value);
      } else if (key === 'timeAvailable') {
        await AsyncStorage.setItem(PREFERRED_TIME_KEY, JSON.stringify(value));
        setSavedTimeAvailable(value);
      }
    } catch (err) {
      console.warn('[RecommendationContext] Failed to save preference:', err);
    }
  }, []);

  /**
   * Reset preferences to defaults
   * Preserves saved platform and time preferences for convenience
   */
  const resetPreferences = useCallback(() => {
    setPreferences({
      ...DEFAULT_PREFERENCES,
      platforms: savedPlatforms, // Keep saved platform preference
      timeAvailable: savedTimeAvailable, // Keep saved time preference
    });
  }, [savedPlatforms, savedTimeAvailable]);

  /**
   * Start a new session
   */
  const startSession = useCallback(async () => {
    try {
      const session = await api.createSession();
      setSessionId(session.session_id);
      setShownGameIds([]);
      setRecommendations([]);
      setFallbackApplied(false);
      setFallbackMessage(null);
      return session;
    } catch (err) {
      // Generate local session ID as fallback
      const localSessionId = `local-${Date.now()}`;
      setSessionId(localSessionId);
      return { session_id: localSessionId };
    }
  }, []);

  /**
   * Get recommendations based on current preferences
   */
  const getRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Ensure we have a session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await startSession();
        currentSessionId = session.session_id;
      }

      const response = await api.getRecommendations({
        time_available: preferences.timeAvailable,
        energy_mood: preferences.energyMood,
        genres: preferences.genres.length > 0 ? preferences.genres : null,
        platforms: preferences.platforms.length > 0 ? preferences.platforms : null,
        session_type: preferences.sessionType,
        discovery_mode: preferences.discoveryMode,
        session_id: currentSessionId,
        excluded_game_ids: shownGameIds,
      });

      setRecommendations(response.recommendations);
      setSessionId(response.session_id);
      setFallbackApplied(response.fallback_applied);
      setFallbackMessage(response.fallback_message);

      // Track shown games
      const newGameIds = response.recommendations.map((r) => r.game_id);
      setShownGameIds((prev) => [...new Set([...prev, ...newGameIds])]);

      return response;
    } catch (err) {
      setError(err.message || 'Failed to get recommendations');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [preferences, sessionId, shownGameIds, startSession]);

  /**
   * Reroll to get different recommendations
   */
  const reroll = useCallback(async () => {
    if (!sessionId) {
      return getRecommendations();
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.rerollRecommendations({
        time_available: preferences.timeAvailable,
        energy_mood: preferences.energyMood,
        genres: preferences.genres.length > 0 ? preferences.genres : null,
        platforms: preferences.platforms.length > 0 ? preferences.platforms : null,
        session_type: preferences.sessionType,
        discovery_mode: preferences.discoveryMode,
        session_id: sessionId,
        excluded_game_ids: shownGameIds,
      });

      setRecommendations(response.recommendations);
      setFallbackApplied(response.fallback_applied);
      setFallbackMessage(response.fallback_message);

      // Track shown games
      const newGameIds = response.recommendations.map((r) => r.game_id);
      setShownGameIds((prev) => [...new Set([...prev, ...newGameIds])]);

      return response;
    } catch (err) {
      setError(err.message || 'Failed to reroll');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [preferences, sessionId, shownGameIds, getRecommendations]);

  /**
   * Accept a recommendation
   * @param {string} gameId - The game ID
   * @param {string} [gameTitle] - The game title for display in history
   */
  const acceptRecommendation = useCallback(
    async (gameId, gameTitle = null) => {
      try {
        await api.acceptRecommendation(gameId, sessionId, gameTitle);
        // Increment history version to trigger refresh in HistoryScreen
        setHistoryVersion((v) => v + 1);
        return true;
      } catch (err) {
        return false;
      }
    },
    [sessionId]
  );

  /**
   * Submit feedback on a recommendation
   */
  const submitFeedback = useCallback(
    async (gameId, signalType) => {
      try {
        await api.submitFeedback(gameId, signalType, sessionId, {
          time_selected: preferences.timeAvailable,
          mood_selected: preferences.energyMood,
          genres_selected: preferences.genres,
        });
        return true;
      } catch (err) {
        // Silent fail
        return false;
      }
    },
    [sessionId, preferences]
  );

  /**
   * Mark a game as already played and get a replacement recommendation
   * This swaps out one game in the recommendations list with a new one
   * @param {string} gameId - The game ID to replace
   * @param {string} signalType - Optional specific signal type (played_loved, played_neutral, played_didnt_stick)
   *                              Defaults to 'already_played' if not specified
   * @param {string} gameTitle - Optional game title for display in history
   */
  const markAsPlayedAndSwap = useCallback(
    async (gameId, signalType = 'already_played', gameTitle = null) => {
      setLoading(true);
      setError(null);

      try {
        // Submit the feedback with the appropriate signal type
        await api.submitFeedback(gameId, signalType, sessionId, {
          time_selected: preferences.timeAvailable,
          mood_selected: preferences.energyMood,
          genres_selected: preferences.genres,
          game_title: gameTitle,
        });

        // Increment history version to trigger refresh in HistoryScreen
        setHistoryVersion((v) => v + 1);

        // Add this game to excluded list
        const newExcludedIds = [...new Set([...shownGameIds, gameId])];
        setShownGameIds(newExcludedIds);

        // Get a single new recommendation to replace this one
        const response = await api.getRecommendations({
          time_available: preferences.timeAvailable,
          energy_mood: preferences.energyMood,
          genres: preferences.genres.length > 0 ? preferences.genres : null,
          platforms: preferences.platforms.length > 0 ? preferences.platforms : null,
          session_type: preferences.sessionType,
          discovery_mode: preferences.discoveryMode,
          session_id: sessionId,
          excluded_game_ids: newExcludedIds,
          limit: 1, // Only need one replacement
        });

        if (response.recommendations?.length > 0) {
          const newGame = response.recommendations[0];

          // Replace the old game with the new one in our list
          setRecommendations((prev) =>
            prev.map((rec) => (rec.game_id === gameId ? newGame : rec))
          );

          // Track the new game
          setShownGameIds((prev) => [...new Set([...prev, newGame.game_id])]);

          return newGame;
        } else {
          // No replacement available, just remove the game
          setRecommendations((prev) => prev.filter((rec) => rec.game_id !== gameId));
          return null;
        }
      } catch (err) {
        setError(err.message || 'Failed to get replacement');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [preferences, sessionId, shownGameIds]
  );

  const value = {
    // State
    sessionId,
    preferences,
    recommendations,
    loading,
    error,
    fallbackApplied,
    fallbackMessage,
    shownGameIds,
    historyVersion, // Increments when signals are recorded, used to trigger history refresh

    // Actions
    updatePreference,
    resetPreferences,
    startSession,
    getRecommendations,
    reroll,
    acceptRecommendation,
    submitFeedback,
    markAsPlayedAndSwap,
  };

  return (
    <RecommendationContext.Provider value={value}>
      {children}
    </RecommendationContext.Provider>
  );
};

export default RecommendationContext;
