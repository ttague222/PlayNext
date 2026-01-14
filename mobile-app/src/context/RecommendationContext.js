/**
 * PlayNext Recommendation Context
 *
 * Manages recommendation state and user preferences.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const PENDING_FEEDBACK_KEY = '@playnxt_pending_feedback';

const RecommendationContext = createContext({});

export const useRecommendation = () => useContext(RecommendationContext);

// Default values matching PRD
const DEFAULT_PREFERENCES = {
  timeAvailable: 60,
  energyMood: 'casual',
  playStyles: [],  // Now an array for multi-select
  platforms: [],   // Now an array for multi-select
  sessionType: 'solo',
  discoveryMode: 'familiar',
};

export const RecommendationProvider = ({ children }) => {
  // Current session
  const [sessionId, setSessionId] = useState(null);

  // User preferences for current session
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // Recommendations
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Shown games (for excluding in rerolls)
  const [shownGameIds, setShownGameIds] = useState([]);

  // Fallback info
  const [fallbackApplied, setFallbackApplied] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState(null);

  // Pending feedback (games accepted but not yet rated)
  const [pendingFeedback, setPendingFeedback] = useState(null);

  // History update counter - increment when signals are recorded
  // HistoryScreen watches this to know when to refresh
  const [historyVersion, setHistoryVersion] = useState(0);

  // Load pending feedback from storage on mount
  useEffect(() => {
    loadPendingFeedback();
  }, []);

  const loadPendingFeedback = async () => {
    try {
      const stored = await AsyncStorage.getItem(PENDING_FEEDBACK_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only show feedback prompt if game was accepted at least 30 minutes ago
        const acceptedAt = new Date(parsed.acceptedAt).getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - acceptedAt >= thirtyMinutes) {
          setPendingFeedback(parsed);
        }
      }
    } catch (err) {
      // Silent fail - pending feedback just won't load
    }
  };

  /**
   * Update a single preference
   */
  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Reset preferences to defaults
   */
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

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
        play_styles: preferences.playStyles.length > 0 ? preferences.playStyles : null,
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
        play_styles: preferences.playStyles.length > 0 ? preferences.playStyles : null,
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
          play_styles_selected: preferences.playStyles,
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
   * Save a game for delayed feedback
   * Called when user accepts a recommendation
   */
  const savePendingFeedback = useCallback(async (game) => {
    try {
      const pendingData = {
        game_id: game.game_id,
        title: game.title,
        acceptedAt: new Date().toISOString(),
        sessionId: sessionId,
      };
      await AsyncStorage.setItem(PENDING_FEEDBACK_KEY, JSON.stringify(pendingData));
    } catch (err) {
      // Silent fail
    }
  }, [sessionId]);

  /**
   * Submit delayed feedback and clear pending
   */
  const submitDelayedFeedback = useCallback(async (signalType) => {
    if (!pendingFeedback) return false;

    try {
      await api.submitFeedback(
        pendingFeedback.game_id,
        signalType,
        pendingFeedback.sessionId,
        {}
      );
      await AsyncStorage.removeItem(PENDING_FEEDBACK_KEY);
      setPendingFeedback(null);
      return true;
    } catch (err) {
      // Silent fail
      return false;
    }
  }, [pendingFeedback]);

  /**
   * Dismiss pending feedback without submitting
   */
  const dismissPendingFeedback = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PENDING_FEEDBACK_KEY);
      setPendingFeedback(null);
    } catch (err) {
      // Silent fail
    }
  }, []);

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
          play_styles_selected: preferences.playStyles,
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
          play_styles: preferences.playStyles.length > 0 ? preferences.playStyles : null,
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
    pendingFeedback,
    historyVersion, // Increments when signals are recorded, used to trigger history refresh

    // Actions
    updatePreference,
    resetPreferences,
    startSession,
    getRecommendations,
    reroll,
    acceptRecommendation,
    submitFeedback,
    savePendingFeedback,
    submitDelayedFeedback,
    dismissPendingFeedback,
    markAsPlayedAndSwap,
  };

  return (
    <RecommendationContext.Provider value={value}>
      {children}
    </RecommendationContext.Provider>
  );
};

export default RecommendationContext;
