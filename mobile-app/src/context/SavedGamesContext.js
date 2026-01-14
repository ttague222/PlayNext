/**
 * PlayNext Saved Games Context
 *
 * Manages save buckets (game collections) state and operations.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { usePremium } from './PremiumContext';

const SavedGamesContext = createContext({});

export const useSavedGames = () => useContext(SavedGamesContext);

// Bucket types
export const BUCKET_TYPES = {
  WANT_TO_PLAY: 'want_to_play',
  CURRENTLY_PLAYING: 'currently_playing',
  FINISHED: 'finished',
  NOT_FOR_ME: 'not_for_me',
};

// Bucket configuration for display
export const BUCKET_CONFIG = {
  [BUCKET_TYPES.WANT_TO_PLAY]: {
    name: 'Want to Play',
    icon: 'bookmark-outline',
    emoji: '📌',
    color: '#f59e0b',
  },
  [BUCKET_TYPES.CURRENTLY_PLAYING]: {
    name: 'Currently Playing',
    icon: 'game-controller',
    emoji: '🎮',
    color: '#22c55e',
  },
  [BUCKET_TYPES.FINISHED]: {
    name: 'Finished',
    icon: 'checkmark-circle',
    emoji: '✅',
    color: '#3b82f6',
  },
  [BUCKET_TYPES.NOT_FOR_ME]: {
    name: 'Not For Me',
    icon: 'close-circle-outline',
    emoji: '❌',
    color: '#ef4444',
  },
};

export const SavedGamesProvider = ({ children }) => {
  const { user } = useAuth();
  const { isPremium } = usePremium();

  // State
  const [buckets, setBuckets] = useState([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bucketsVersion, setBucketsVersion] = useState(0); // For triggering refreshes

  /**
   * Fetch all buckets for the current user
   */
  const fetchBuckets = useCallback(async () => {
    if (!isPremium) {
      setBuckets([]);
      setTotalGames(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getBuckets();
      setBuckets(response.buckets || []);
      setTotalGames(response.total_games || 0);
    } catch (err) {
      console.error('[SavedGamesContext] Error fetching buckets:', err);
      // Don't show error for 401 - user just needs to sign in
      if (err.response?.status !== 401) {
        setError('Failed to load saved games');
      }
      setBuckets([]);
      setTotalGames(0);
    } finally {
      setLoading(false);
    }
  }, [user, isPremium]);

  /**
   * Add a game to a bucket
   */
  const addGameToBucket = useCallback(async (bucketType, gameId, gameTitle, notes = null) => {
    if (!isPremium) {
      throw new Error('Premium required to save games');
    }

    try {
      await api.addGameToBucket(bucketType, gameId, gameTitle, notes);
      // Trigger refresh
      setBucketsVersion((v) => v + 1);
      return true;
    } catch (err) {
      console.error('[SavedGamesContext] Error adding game to bucket:', err);
      throw err;
    }
  }, [user, isPremium]);

  /**
   * Remove a game from a bucket
   */
  const removeGameFromBucket = useCallback(async (bucketType, gameId) => {
    if (!isPremium) {
      throw new Error('Premium required');
    }

    try {
      await api.removeGameFromBucket(bucketType, gameId);
      // Trigger refresh
      setBucketsVersion((v) => v + 1);
      return true;
    } catch (err) {
      console.error('[SavedGamesContext] Error removing game from bucket:', err);
      throw err;
    }
  }, [user, isPremium]);

  /**
   * Move a game between buckets
   */
  const moveGame = useCallback(async (fromBucketType, toBucketType, gameId) => {
    if (!isPremium) {
      throw new Error('Premium required');
    }

    try {
      await api.moveGame(fromBucketType, toBucketType, gameId);
      // Trigger refresh
      setBucketsVersion((v) => v + 1);
      return true;
    } catch (err) {
      console.error('[SavedGamesContext] Error moving game:', err);
      throw err;
    }
  }, [user, isPremium]);

  /**
   * Get which bucket a game is in (if any)
   */
  const getGameBucket = useCallback(async (gameId) => {
    if (!isPremium) {
      return null;
    }

    try {
      const response = await api.getGameBucket(gameId);
      return response.bucket_type;
    } catch (err) {
      console.error('[SavedGamesContext] Error getting game bucket:', err);
      return null;
    }
  }, [user]);

  /**
   * Get bucket details with games
   */
  const getBucketWithGames = useCallback(async (bucketType, limit = 50, offset = 0) => {
    if (!user || user.isAnonymous) {
      return null;
    }

    try {
      return await api.getBucket(bucketType, limit, offset);
    } catch (err) {
      console.error('[SavedGamesContext] Error getting bucket:', err);
      throw err;
    }
  }, [user]);

  /**
   * Check if user can save games (premium only)
   */
  const canSaveGames = isPremium;

  const value = {
    // State
    buckets,
    totalGames,
    loading,
    error,
    bucketsVersion,
    canSaveGames,

    // Actions
    fetchBuckets,
    addGameToBucket,
    removeGameFromBucket,
    moveGame,
    getGameBucket,
    getBucketWithGames,
  };

  return (
    <SavedGamesContext.Provider value={value}>
      {children}
    </SavedGamesContext.Provider>
  );
};

export default SavedGamesContext;
