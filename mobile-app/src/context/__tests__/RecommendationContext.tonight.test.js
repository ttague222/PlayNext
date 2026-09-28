/**
 * Tonight's Picks additions to RecommendationContext:
 * - successful normal-flow fetch persists last context + today's cache
 * - startTonightSession seeds a session from cache without a network call
 * - sessionSource rides rec_requested / rec_accepted
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
    acceptRecommendation: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock('../../services/tonightService', () => ({
  saveLastContext: jest.fn(() => Promise.resolve(true)),
  saveTonightCache: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import api from '../../services/api';
import { saveLastContext, saveTonightCache } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import { RecommendationProvider, useRecommendation } from '../RecommendationContext';

const RESPONSE = {
  session_id: 'sess-1',
  recommendations: [
    { game_id: 'hades', title: 'Hades' },
    { game_id: 'celeste', title: 'Celeste' },
  ],
  fallback_applied: false,
  fallback_message: null,
};

// Probe harness: exposes the hook value to the test.
let ctx;
const Probe = () => {
  ctx = useRecommendation();
  return <Text>probe</Text>;
};
// house pattern (see WhatsNewScreen.test.js): render() is awaited so the
// initial commit (and the Probe's ctx assignment) has flushed.
const renderCtx = () =>
  render(
    <RecommendationProvider>
      <Probe />
    </RecommendationProvider>
  );

beforeEach(() => jest.clearAllMocks());

it('persists context and rewrites todays cache on successful normal fetch', async () => {
  api.getRecommendations.mockResolvedValue(RESPONSE);
  await renderCtx();
  await act(async () => {
    await ctx.updatePreference('timeAvailable', 60);
    await ctx.updatePreference('energyMood', 'casual');
  });
  await act(async () => {
    await ctx.getRecommendations();
  });
  expect(saveLastContext).toHaveBeenCalledWith(expect.objectContaining({ timeAvailable: 60, energyMood: 'casual' }));
  expect(saveTonightCache).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'sess-1',
    games: RESPONSE.recommendations,
  }));
  expect(logEvent).toHaveBeenCalledWith('rec_requested', expect.objectContaining({ source: 'flow' }));
});

it('startTonightSession seeds state from cache with no API call', async () => {
  await renderCtx();
  const cache = {
    date: '2026-10-05',
    sessionId: 'cached-sess',
    context: { timeAvailable: 30, energyMood: 'wind_down', genres: [], platforms: [], sessionType: 'solo', discoveryMode: 'familiar' },
    games: RESPONSE.recommendations,
  };
  await act(async () => {
    expect(ctx.startTonightSession(cache)).toBe(true);
  });
  await waitFor(() => expect(ctx.recommendations).toEqual(RESPONSE.recommendations));
  expect(ctx.sessionId).toBe('cached-sess');
  expect(ctx.preferences.timeAvailable).toBe(30);
  expect(ctx.preferences.energyMood).toBe('wind_down');
  expect(ctx.shownGameIds).toEqual(['hades', 'celeste']);
  expect(api.getRecommendations).not.toHaveBeenCalled();

  await act(async () => {
    await ctx.acceptRecommendation('hades', 'Hades');
  });
  expect(logEvent).toHaveBeenCalledWith('rec_accepted', expect.objectContaining({ source: 'tonight' }));
});

it('rejects an empty cache', async () => {
  await renderCtx();
  act(() => {
    expect(ctx.startTonightSession({ games: [] })).toBe(false);
    expect(ctx.startTonightSession(null)).toBe(false);
  });
});
