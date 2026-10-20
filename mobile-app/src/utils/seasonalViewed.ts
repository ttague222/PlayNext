/**
 * Once-per-collection-per-local-day `seasonal_collection_viewed` logging.
 *
 * The last-logged date for each collection id is kept in AsyncStorage, so the
 * dedupe survives app restarts and is shared by every card on the Play screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateString } from '../services/tonightService';
import { logEvent } from '../services/analyticsService';

export const SEASONAL_VIEWED_KEY = '@playnxt_seasonal_viewed';

// Two cards mount together and each does a read-modify-write of the same
// map; serialized so the second writer cannot drop the first one's entry.
let queue: Promise<unknown> = Promise.resolve();

async function readViewed(): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(SEASONAL_VIEWED_KEY)) ?? 'null');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Logs the view unless this collection was already logged on today's local date. Resolves to whether it logged. */
export function logSeasonalViewedOnce(collectionId: string, seasonId: string): Promise<boolean> {
  const step = queue.then(async () => {
    const today: string = localDateString();
    const viewed = await readViewed();
    if (viewed[collectionId] === today) return false;
    logEvent('seasonal_collection_viewed', { collection_id: collectionId, season_id: seasonId });
    try {
      await AsyncStorage.setItem(SEASONAL_VIEWED_KEY, JSON.stringify({ ...viewed, [collectionId]: today }));
    } catch {
      // Worst case the view is logged again on the next focus.
    }
    return true;
  });
  queue = step.catch(() => {});
  return step;
}
