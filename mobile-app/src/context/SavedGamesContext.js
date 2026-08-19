/**
 * PlayNext Saved Games Context
 *
 * Manages save buckets (game collections) state and operations.
 * Supports both local storage (anonymous users) and server sync (signed-in users).
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SavedGamesContext = createContext({});

export const useSavedGames = () => useContext(SavedGamesContext);

// Storage key for local buckets
const LOCAL_BUCKETS_KEY = '@playnxt_local_buckets';

// Page size when pulling the server-side "Not For Me" bucket. The full bucket is
// paged through so no game is silently left out of the recommendation exclusions.
const NOT_FOR_ME_PAGE_SIZE = 200;

// Bucket types - unified game library
export const BUCKET_TYPES = {
  BACKLOG: 'backlog',
  PLAYING: 'playing',
  PLAYED: 'played',
  NOT_FOR_ME: 'not_for_me',
};

// Bucket configuration for display
export const BUCKET_CONFIG = {
  [BUCKET_TYPES.BACKLOG]: {
    name: 'Backlog',
    icon: 'bookmark-outline',
    color: '#f59e0b',
    description: 'Games to play later',
  },
  [BUCKET_TYPES.PLAYING]: {
    name: 'Playing',
    icon: 'game-controller',
    color: '#22c55e',
    description: 'Currently playing',
  },
  [BUCKET_TYPES.PLAYED]: {
    name: 'Played',
    icon: 'checkmark-circle',
    color: '#3b82f6',
    description: 'Finished or tried',
  },
  [BUCKET_TYPES.NOT_FOR_ME]: {
    name: 'Not For Me',
    icon: 'close-circle-outline',
    color: '#ef4444',
    description: 'Skip in recommendations',
  },
};

// Legacy bucket type mapping (for migrating old data)
const LEGACY_BUCKET_MAP = {
  'want_to_play': BUCKET_TYPES.BACKLOG,
  'currently_playing': BUCKET_TYPES.PLAYING,
  'finished': BUCKET_TYPES.PLAYED,
  'not_for_me': BUCKET_TYPES.NOT_FOR_ME,
};

// Initialize empty local buckets structure
const createEmptyLocalBuckets = () => ({
  [BUCKET_TYPES.BACKLOG]: [],
  [BUCKET_TYPES.PLAYING]: [],
  [BUCKET_TYPES.PLAYED]: [],
  [BUCKET_TYPES.NOT_FOR_ME]: [],
});

// Migrate legacy bucket data to new format
const migrateLegacyBuckets = (oldBuckets) => {
  const newBuckets = createEmptyLocalBuckets();

  for (const [oldType, games] of Object.entries(oldBuckets)) {
    const newType = LEGACY_BUCKET_MAP[oldType] || oldType;
    if (newBuckets[newType]) {
      newBuckets[newType] = [...newBuckets[newType], ...games];
    }
  }

  return newBuckets;
};

export const SavedGamesProvider = ({ children }) => {
  const { user } = useAuth();

  // State
  const [buckets, setBuckets] = useState([]);
  const [localBuckets, setLocalBuckets] = useState(createEmptyLocalBuckets());
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bucketsVersion, setBucketsVersion] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Game IDs in the server-side "Not For Me" bucket. Only meaningful when signed
  // in; anonymous users have their equivalent derived from localBuckets below.
  const [serverNotForMeIds, setServerNotForMeIds] = useState([]);

  // Check if user is signed in (not anonymous)
  const isSignedIn = user && !user.isAnonymous;

  /**
   * Load local buckets from AsyncStorage on mount (with migration)
   */
  useEffect(() => {
    const loadLocalBuckets = async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCAL_BUCKETS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Check if migration is needed (old bucket types)
          const hasLegacyKeys = Object.keys(parsed).some(key =>
            ['want_to_play', 'currently_playing', 'finished'].includes(key)
          );
          if (hasLegacyKeys) {
            const migrated = migrateLegacyBuckets(parsed);
            setLocalBuckets(migrated);
            // Save migrated data
            await AsyncStorage.setItem(LOCAL_BUCKETS_KEY, JSON.stringify(migrated));
          } else {
            setLocalBuckets(parsed);
          }
        }
      } catch (err) {
        console.warn('[SavedGamesContext] Failed to load local buckets:', err);
      } finally {
        setIsInitialized(true);
      }
    };

    loadLocalBuckets();
  }, []);

  /**
   * Save local buckets to AsyncStorage whenever they change
   */
  useEffect(() => {
    if (!isInitialized) return;

    const saveLocalBuckets = async () => {
      try {
        await AsyncStorage.setItem(LOCAL_BUCKETS_KEY, JSON.stringify(localBuckets));
      } catch (err) {
        console.warn('[SavedGamesContext] Failed to save local buckets:', err);
      }
    };

    saveLocalBuckets();
  }, [localBuckets, isInitialized]);

  /**
   * Sync local buckets to server when user signs in
   */
  useEffect(() => {
    const syncLocalToServer = async () => {
      if (!isSignedIn || !isInitialized) return;

      // Check if there are local games to sync
      const hasLocalGames = Object.values(localBuckets).some(games => games.length > 0);
      if (!hasLocalGames) return;

      console.log('[SavedGamesContext] Syncing local buckets to server...');

      try {
        // Upload each local game to the server
        for (const [bucketType, games] of Object.entries(localBuckets)) {
          for (const game of games) {
            try {
              const gameTitle = game.game_title || game.title; // Support both old and new format
              await api.addGameToBucket(bucketType, game.game_id, gameTitle, game.notes);
            } catch (err) {
              // Ignore duplicate errors, game might already exist on server
              if (!err.response?.data?.detail?.includes('already')) {
                console.warn('[SavedGamesContext] Failed to sync game:', game.game_title || game.title, err);
              }
            }
          }
        }

        // Clear local buckets after successful sync
        setLocalBuckets(createEmptyLocalBuckets());
        console.log('[SavedGamesContext] Local buckets synced and cleared');

        // Refresh server buckets
        setBucketsVersion((v) => v + 1);
      } catch (err) {
        console.error('[SavedGamesContext] Failed to sync local buckets:', err);
      }
    };

    syncLocalToServer();
  }, [isSignedIn, isInitialized]);

  /**
   * "Not For Me" game IDs held locally (anonymous users)
   */
  const localNotForMeIds = useMemo(
    () => (localBuckets[BUCKET_TYPES.NOT_FOR_ME] || []).map((g) => g.game_id),
    [localBuckets]
  );

  /**
   * Keep the server-side "Not For Me" IDs in sync for signed-in users.
   * Refetches whenever buckets change so exclusions stay accurate.
   */
  useEffect(() => {
    if (!isSignedIn) {
      setServerNotForMeIds([]);
      return;
    }

    let cancelled = false;

    const fetchNotForMeIds = async () => {
      try {
        const ids = [];
        let offset = 0;
        // Page until we've seen the whole bucket — a partial fetch would let a
        // "Not For Me" game slip back into recommendations.
        for (;;) {
          const page = await api.getBucket(
            BUCKET_TYPES.NOT_FOR_ME,
            NOT_FOR_ME_PAGE_SIZE,
            offset
          );
          const games = page?.games || [];
          ids.push(...games.map((g) => g.game_id));

          const total = page?.game_count ?? ids.length;
          if (games.length === 0 || ids.length >= total) break;
          offset += games.length;
        }

        if (!cancelled) {
          setServerNotForMeIds(ids);
        }
      } catch (err) {
        // Non-fatal: recommendations still work, they just won't exclude this
        // bucket until the next successful fetch.
        console.warn('[SavedGamesContext] Failed to load Not For Me bucket:', err);
      }
    };

    fetchNotForMeIds();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, bucketsVersion]);

  /**
   * Games the user marked "Not For Me" — excluded from recommendations.
   * Works for both anonymous (local) and signed-in (server) users.
   */
  const notForMeGameIds = isSignedIn ? serverNotForMeIds : localNotForMeIds;

  /**
   * Optimistically track a bucket change so an immediate reroll already
   * excludes the game, before the server refetch lands.
   */
  const applyNotForMeOptimistic = useCallback((gameId, isNotForMe) => {
    setServerNotForMeIds((prev) =>
      isNotForMe
        ? (prev.includes(gameId) ? prev : [...prev, gameId])
        : prev.filter((id) => id !== gameId)
    );
  }, []);

  /**
   * Convert local buckets to display format
   */
  const getLocalBucketsDisplay = useCallback(() => {
    return Object.entries(localBuckets).map(([bucketType, games]) => {
      const config = BUCKET_CONFIG[bucketType];
      return {
        bucket_type: bucketType,
        name: config.name,
        emoji: config.emoji,
        color: config.color,
        game_count: games.length,
      };
    }).filter(bucket => bucket.game_count > 0);
  }, [localBuckets]);

  /**
   * Fetch all buckets for the current user
   */
  const fetchBuckets = useCallback(async () => {
    if (isSignedIn) {
      // Fetch from server
      setLoading(true);
      setError(null);

      try {
        const response = await api.getBuckets();
        setBuckets(response.buckets || []);
        setTotalGames(response.total_games || 0);
      } catch (err) {
        console.error('[SavedGamesContext] Error fetching buckets:', err);
        if (err.response?.status !== 401) {
          setError('Failed to load saved games');
        }
        setBuckets([]);
        setTotalGames(0);
      } finally {
        setLoading(false);
      }
    } else {
      // Use local buckets
      const localDisplay = getLocalBucketsDisplay();
      setBuckets(localDisplay);
      setTotalGames(Object.values(localBuckets).reduce((sum, games) => sum + games.length, 0));
    }
  }, [isSignedIn, localBuckets, getLocalBucketsDisplay]);

  /**
   * Add a game to a bucket
   * @param {string} bucketType - The bucket type to add to
   * @param {string} gameId - The game ID
   * @param {string} gameTitle - The game title
   * @param {string|null} notes - Optional notes
   * @param {Object|null} fullGameData - Optional full game data for offline access
   */
  const addGameToBucket = useCallback(async (bucketType, gameId, gameTitle, notes = null, fullGameData = null) => {
    if (isSignedIn) {
      // Save to server
      try {
        await api.addGameToBucket(bucketType, gameId, gameTitle, notes);
        // The server moves a game out of every other bucket, so adding to any
        // other bucket also clears a prior "Not For Me" mark.
        applyNotForMeOptimistic(gameId, bucketType === BUCKET_TYPES.NOT_FOR_ME);
        setBucketsVersion((v) => v + 1);
        return true;
      } catch (err) {
        console.error('[SavedGamesContext] Error adding game to bucket:', err);
        throw err;
      }
    } else {
      // Save locally with full game data for offline display
      const game = {
        game_id: gameId,
        game_title: gameTitle,
        notes,
        added_at: new Date().toISOString(),
        // Store full game data for offline access to game details
        ...(fullGameData && {
          platforms: fullGameData.platforms,
          description_short: fullGameData.description_short,
          store_links: fullGameData.store_links,
          subscription_services: fullGameData.subscription_services,
          time_to_fun: fullGameData.time_to_fun,
          stop_friendliness: fullGameData.stop_friendliness,
          fun_fact: fullGameData.fun_fact,
          genres: fullGameData.genres,
          moods: fullGameData.moods,
          play_style: fullGameData.play_style,
          energy_level: fullGameData.energy_level,
        }),
      };

      setLocalBuckets((prev) => {
        // Remove from any existing bucket first
        const updated = { ...prev };
        for (const bt of Object.keys(updated)) {
          updated[bt] = updated[bt].filter((g) => g.game_id !== gameId);
        }
        // Add to new bucket
        updated[bucketType] = [...updated[bucketType], game];
        return updated;
      });

      setBucketsVersion((v) => v + 1);
      return true;
    }
  }, [isSignedIn, applyNotForMeOptimistic]);

  /**
   * Remove a game from a bucket
   */
  const removeGameFromBucket = useCallback(async (bucketType, gameId) => {
    if (isSignedIn) {
      try {
        await api.removeGameFromBucket(bucketType, gameId);
        if (bucketType === BUCKET_TYPES.NOT_FOR_ME) {
          applyNotForMeOptimistic(gameId, false);
        }
        setBucketsVersion((v) => v + 1);
        return true;
      } catch (err) {
        console.error('[SavedGamesContext] Error removing game from bucket:', err);
        throw err;
      }
    } else {
      // Remove locally
      setLocalBuckets((prev) => ({
        ...prev,
        [bucketType]: prev[bucketType].filter((g) => g.game_id !== gameId),
      }));
      setBucketsVersion((v) => v + 1);
      return true;
    }
  }, [isSignedIn, applyNotForMeOptimistic]);

  /**
   * Move a game between buckets
   */
  const moveGame = useCallback(async (fromBucketType, toBucketType, gameId) => {
    if (isSignedIn) {
      try {
        await api.moveGame(fromBucketType, toBucketType, gameId);
        if (toBucketType === BUCKET_TYPES.NOT_FOR_ME) {
          applyNotForMeOptimistic(gameId, true);
        } else if (fromBucketType === BUCKET_TYPES.NOT_FOR_ME) {
          applyNotForMeOptimistic(gameId, false);
        }
        setBucketsVersion((v) => v + 1);
        return true;
      } catch (err) {
        console.error('[SavedGamesContext] Error moving game:', err);
        throw err;
      }
    } else {
      // Move locally
      setLocalBuckets((prev) => {
        const game = prev[fromBucketType].find((g) => g.game_id === gameId);
        if (!game) return prev;

        return {
          ...prev,
          [fromBucketType]: prev[fromBucketType].filter((g) => g.game_id !== gameId),
          [toBucketType]: [...prev[toBucketType], game],
        };
      });
      setBucketsVersion((v) => v + 1);
      return true;
    }
  }, [isSignedIn, applyNotForMeOptimistic]);

  /**
   * Get which bucket a game is in (if any)
   */
  const getGameBucket = useCallback(async (gameId) => {
    if (isSignedIn) {
      try {
        const response = await api.getGameBucket(gameId);
        return response.bucket_type;
      } catch (err) {
        console.error('[SavedGamesContext] Error getting game bucket:', err);
        return null;
      }
    } else {
      // Check local buckets
      for (const [bucketType, games] of Object.entries(localBuckets)) {
        if (games.some((g) => g.game_id === gameId)) {
          return bucketType;
        }
      }
      return null;
    }
  }, [isSignedIn, localBuckets]);

  /**
   * Get bucket details with games
   */
  const getBucketWithGames = useCallback(async (bucketType, limit = 50, offset = 0) => {
    if (isSignedIn) {
      try {
        return await api.getBucket(bucketType, limit, offset);
      } catch (err) {
        console.error('[SavedGamesContext] Error getting bucket:', err);
        throw err;
      }
    } else {
      // Return local bucket data
      const config = BUCKET_CONFIG[bucketType];
      const games = localBuckets[bucketType] || [];
      const paginatedGames = games.slice(offset, offset + limit);

      // Normalize game_title field (support both old 'title' and new 'game_title' format)
      const normalizedGames = paginatedGames.map(game => ({
        ...game,
        game_title: game.game_title || game.title,
      }));

      return {
        bucket_type: bucketType,
        name: config.name,
        emoji: config.emoji,
        color: config.color,
        games: normalizedGames,
        game_count: games.length,
        total_games: games.length,
        limit,
        offset,
      };
    }
  }, [isSignedIn, localBuckets]);

  /**
   * Everyone can save games now (locally or to server)
   */
  const canSaveGames = true;

  /**
   * Check if using local storage (for showing sync prompt)
   */
  const isUsingLocalStorage = !isSignedIn;

  const value = {
    // State
    buckets,
    totalGames,
    loading,
    error,
    bucketsVersion,
    canSaveGames,
    isUsingLocalStorage,
    isInitialized,
    notForMeGameIds,

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
