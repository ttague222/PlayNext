/**
 * Seasonal collection sessions in RecommendationContext:
 * - startCollectionSession seeds a Results session from fetched picks, no network call
 * - sessionSource 'seasonal' + collection_id ride the session's analytics events
 * - a collection session never touches the saved Tonight's Picks context/cache
 * - starting a normal flow clears the collection
 */
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('../SavedGamesContext', () => ({
  useSavedGames: () => ({ notForMeGameIds: [] }),
}));
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    createSession: jest.fn(() => Promise.resolve({ session_id: 'sess-1' })),
    getRecommendations: jest.fn(),
    rerollRecommendations: jest.fn(),
    acceptRecommendation: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock('../../services/tonightService', () => ({
  saveLastContext: jest.fn(() => Promise.resolve(true)),
  saveTonightCache: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { saveLastContext, saveTonightCache } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import { RecommendationProvider, useRecommendation } from '../RecommendationContext';

const GAMES = [
  { game_id: 'stardew', title: 'Stardew Valley' },
  { game_id: 'unpacking', title: 'Unpacking' },
];

const COLLECTION = {
  id: 'harvest-2026-long-weekend',
  title: 'Harvest long weekend',
  blurb: 'Cozy picks for a long weekend.',
  params: {
    time_available: 120,
    energy_mood: 'wind_down',
    genres: ['simulation'],
    session_type: 'solo',
    discovery_mode: 'adventurous',
  },
};

const PICKS = {
  date: '2026-10-20',
  collectionId: COLLECTION.id,
  sessionId: 'coll-sess',
  games: GAMES,
  fallbackApplied: false,
  fallbackMessage: null,
};

const FLOW_RESPONSE = {
  session_id: 'sess-2',
  recommendations: [{ game_id: 'hades', title: 'Hades' }],
  fallback_applied: false,
  fallback_message: null,
};

const REROLL_RESPONSE = {
  recommendations: [{ game_id: 'cozy-grove', title: 'Cozy Grove' }],
  fallback_applied: false,
  fallback_message: null,
};

let ctx;
const Probe = () => {
  ctx = useRecommendation();
  return <Text>probe</Text>;
};
const renderCtx = () =>
  render(
    <RecommendationProvider>
      <Probe />
    </RecommendationProvider>
  );

const eventCalls = (name) => logEvent.mock.calls.filter(([n]) => n === name);

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
});

it('seeds a session from the collection with no network call', async () => {
  await renderCtx();
  await act(async () => {
    expect(ctx.startCollectionSession(COLLECTION, PICKS)).toBe(true);
  });
  await waitFor(() => expect(ctx.recommendations).toEqual(GAMES));
  expect(ctx.sessionId).toBe('coll-sess');
  expect(ctx.collectionId).toBe('harvest-2026-long-weekend');
  expect(ctx.shownGameIds).toEqual(['stardew', 'unpacking']);
  expect(ctx.preferences).toEqual(
    expect.objectContaining({
      timeAvailable: 120,
      energyMood: 'wind_down',
      genres: ['simulation'],
      sessionType: 'solo',
      discoveryMode: 'adventurous',
      platforms: [],
    })
  );
  expect(api.getRecommendations).not.toHaveBeenCalled();
  expect(api.createSession).not.toHaveBeenCalled();
});

it('keeps the user saved platforms and defaults optional params', async () => {
  AsyncStorage.getItem.mockImplementation((key) =>
    Promise.resolve(key === '@playnxt_preferred_platforms' ? JSON.stringify(['switch', 'pc']) : null)
  );
  await renderCtx();
  await waitFor(() => expect(ctx.preferences.platforms).toEqual(['switch', 'pc']));
  const bare = { ...COLLECTION, params: { time_available: 60, energy_mood: 'casual' } };
  await act(async () => {
    ctx.startCollectionSession(bare, PICKS);
  });
  await waitFor(() => expect(ctx.collectionId).toBe(COLLECTION.id));
  expect(ctx.preferences.platforms).toEqual(['switch', 'pc']);
  expect(ctx.preferences.genres).toEqual([]);
  expect(ctx.preferences.sessionType).toBe('any');
  expect(ctx.preferences.discoveryMode).toBe('familiar');
  expect(eventCalls('recommendation_started')[0][1]).toEqual(
    expect.objectContaining({ platform_filter: 'pc,switch' })
  );
});

it('logs recommendation_started and recommendation_viewed with collection_id', async () => {
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  expect(logEvent).toHaveBeenCalledWith('recommendation_started', {
    minutes: 120,
    mood: 'wind_down',
    platform_filter: 'none',
    library_mode: 'none',
    pick_source: 'seasonal',
    collection_id: 'harvest-2026-long-weekend',
  });
  await waitFor(() =>
    expect(logEvent).toHaveBeenCalledWith(
      'recommendation_viewed',
      expect.objectContaining({
        result_count: 2,
        pick_source: 'seasonal',
        collection_id: 'harvest-2026-long-weekend',
      })
    )
  );
  expect(eventCalls('recommendation_viewed')[0][1]).not.toHaveProperty('latency_ms');
});

it('surfaces fallbackApplied and the message from the picks', async () => {
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, {
      ...PICKS,
      fallbackApplied: true,
      fallbackMessage: 'Widened the search a bit.',
    });
  });
  await waitFor(() => expect(ctx.fallbackApplied).toBe(true));
  expect(ctx.fallbackMessage).toBe('Widened the search a bit.');
});

it('accepting a pick logs game_selected and rec_accepted with collection_id', async () => {
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  await act(async () => {
    await ctx.acceptRecommendation('stardew', 'Stardew Valley');
  });
  expect(logEvent).toHaveBeenCalledWith(
    'game_selected',
    expect.objectContaining({
      game_id: 'stardew',
      rank: 1,
      pick_source: 'seasonal',
      collection_id: 'harvest-2026-long-weekend',
    })
  );
  expect(logEvent).toHaveBeenCalledWith('rec_accepted', {
    game_id: 'stardew',
    pick_source: 'seasonal',
    collection_id: 'harvest-2026-long-weekend',
  });
});

it('a reroll keeps collection_id on rec_requested and recommendation_viewed', async () => {
  api.rerollRecommendations.mockResolvedValue(REROLL_RESPONSE);
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  logEvent.mockClear();
  await act(async () => {
    await ctx.reroll();
  });
  expect(api.rerollRecommendations).toHaveBeenCalledWith(
    expect.objectContaining({ session_id: 'coll-sess', excluded_game_ids: ['stardew', 'unpacking'] })
  );
  expect(logEvent).toHaveBeenCalledWith(
    'rec_requested',
    expect.objectContaining({
      is_reroll: true,
      pick_source: 'seasonal',
      collection_id: 'harvest-2026-long-weekend',
    })
  );
  await waitFor(() =>
    expect(logEvent).toHaveBeenCalledWith(
      'recommendation_viewed',
      expect.objectContaining({ pick_source: 'seasonal', collection_id: 'harvest-2026-long-weekend' })
    )
  );
});

it('never writes the saved Tonight context or cache', async () => {
  api.rerollRecommendations.mockResolvedValue(REROLL_RESPONSE);
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  await act(async () => {
    await ctx.reroll();
  });
  await act(async () => {
    await ctx.acceptRecommendation('cozy-grove', 'Cozy Grove');
  });
  expect(saveTonightCache).not.toHaveBeenCalled();
  expect(saveLastContext).not.toHaveBeenCalled();
});

it('rejects empty picks and leaves the session untouched', async () => {
  await renderCtx();
  await act(async () => {
    expect(ctx.startCollectionSession(COLLECTION, { ...PICKS, games: [] })).toBe(false);
    expect(ctx.startCollectionSession(COLLECTION, null)).toBe(false);
  });
  expect(ctx.collectionId).toBeNull();
  expect(logEvent).not.toHaveBeenCalled();
});

it('startSession clears the collection so a normal flow logs flow with no collection_id', async () => {
  api.getRecommendations.mockResolvedValue(FLOW_RESPONSE);
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  await waitFor(() => expect(ctx.collectionId).toBe(COLLECTION.id));

  await act(async () => {
    await ctx.startSession();
  });
  expect(ctx.collectionId).toBeNull();

  await act(async () => {
    await ctx.updatePreference('timeAvailable', 60);
    await ctx.updatePreference('energyMood', 'casual');
  });
  logEvent.mockClear();
  await act(async () => {
    await ctx.getRecommendations();
  });
  expect(logEvent).toHaveBeenCalledWith('recommendation_started', {
    minutes: 60,
    mood: 'casual',
    platform_filter: 'none',
    library_mode: 'none',
    pick_source: 'flow',
  });
  expect(eventCalls('rec_requested')[0][1]).not.toHaveProperty('collection_id');
  await waitFor(() => expect(eventCalls('recommendation_viewed')).toHaveLength(1));
  expect(eventCalls('recommendation_viewed')[0][1]).not.toHaveProperty('collection_id');
});

it('startTonightSession clears a prior collection', async () => {
  await renderCtx();
  await act(async () => {
    ctx.startCollectionSession(COLLECTION, PICKS);
  });
  await act(async () => {
    ctx.startTonightSession({
      sessionId: 'cached',
      games: GAMES,
      context: { timeAvailable: 30, energyMood: 'casual' },
    });
  });
  expect(ctx.collectionId).toBeNull();
  await act(async () => {
    await ctx.acceptRecommendation('stardew', 'Stardew Valley');
  });
  expect(logEvent).toHaveBeenCalledWith('rec_accepted', { game_id: 'stardew', pick_source: 'tonight' });
});
