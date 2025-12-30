/**
 * Game Image Service
 *
 * Fetches game cover images from RAWG API with caching.
 * Falls back to stylized placeholders when API key not configured or image not found.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAWG_API_KEY = Constants.expoConfig?.extra?.rawgApiKey || process.env.EXPO_PUBLIC_RAWG_API_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';
const CACHE_PREFIX = 'game_image_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache for faster access during session
const memoryCache = new Map();

/**
 * Generate a gradient color based on game title
 * Used as fallback when no image available
 */
const generateGradientColors = (title) => {
  const hash = title.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const gradients = [
    ['#667eea', '#764ba2'], // Purple
    ['#f093fb', '#f5576c'], // Pink
    ['#4facfe', '#00f2fe'], // Blue
    ['#43e97b', '#38f9d7'], // Green
    ['#fa709a', '#fee140'], // Coral
    ['#a8edea', '#fed6e3'], // Soft teal
    ['#ff9a9e', '#fecfef'], // Soft pink
    ['#ffecd2', '#fcb69f'], // Peach
    ['#667eea', '#764ba2'], // Indigo
    ['#f6d365', '#fda085'], // Orange
  ];

  return gradients[Math.abs(hash) % gradients.length];
};

/**
 * Get cached image URL
 */
const getCachedImage = async (gameId) => {
  // Check memory cache first
  if (memoryCache.has(gameId)) {
    return memoryCache.get(gameId);
  }

  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${gameId}`);
    if (cached) {
      const { url, timestamp } = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        memoryCache.set(gameId, url);
        return url;
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }
  return null;
};

/**
 * Cache image URL
 */
const cacheImage = async (gameId, url) => {
  memoryCache.set(gameId, url);
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${gameId}`,
      JSON.stringify({ url, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn('Cache write error:', error);
  }
};

/**
 * Search RAWG API for game image
 */
const fetchFromRAWG = async (gameTitle) => {
  if (!RAWG_API_KEY) {
    return null;
  }

  try {
    const searchQuery = encodeURIComponent(gameTitle);
    const response = await fetch(
      `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&search=${searchQuery}&page_size=1`
    );

    if (!response.ok) {
      console.warn('RAWG API error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const game = data.results[0];
      // RAWG provides background_image which is high quality
      return game.background_image || null;
    }
  } catch (error) {
    console.warn('RAWG fetch error:', error);
  }

  return null;
};

/**
 * Get game image URL
 * Returns object with imageUrl (or null) and fallback gradient colors
 */
export const getGameImage = async (gameId, gameTitle) => {
  const fallbackColors = generateGradientColors(gameTitle);

  // Check cache first
  const cachedUrl = await getCachedImage(gameId);
  if (cachedUrl) {
    return { imageUrl: cachedUrl, fallbackColors };
  }

  // If no API key, just return fallback
  if (!RAWG_API_KEY) {
    return { imageUrl: null, fallbackColors };
  }

  // Fetch from RAWG
  const imageUrl = await fetchFromRAWG(gameTitle);
  if (imageUrl) {
    await cacheImage(gameId, imageUrl);
    return { imageUrl, fallbackColors };
  }

  // Cache null result to avoid repeated API calls
  await cacheImage(gameId, null);
  return { imageUrl: null, fallbackColors };
};

/**
 * Preload images for a list of games
 * Useful for preloading before showing results
 */
export const preloadGameImages = async (games) => {
  if (!RAWG_API_KEY) return;

  const promises = games.map((game) =>
    getGameImage(game.game_id, game.title).catch(() => null)
  );

  await Promise.allSettled(promises);
};

/**
 * Clear image cache
 */
export const clearImageCache = async () => {
  memoryCache.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const imageCacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(imageCacheKeys);
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
};

export default {
  getGameImage,
  preloadGameImages,
  clearImageCache,
  generateGradientColors,
};
