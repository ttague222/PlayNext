/**
 * Regression tests for the "Not For Me" bucket.
 *
 * The bucket is labelled "Skip in recommendations" in the UI, but for a while
 * nothing enforced that: `excluded_game_ids` carried only games shown in the
 * current session, so a game marked Not For Me could be recommended again on
 * the very next reroll.
 *
 * These tests drive the real provider tree and use a fake API that honours
 * `excluded_game_ids` the way the server does, so they fail if the exclusion
 * stops being sent.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// --- Mocks -----------------------------------------------------------------

// Controlled per-test so we can exercise both the anonymous (local buckets)
// and signed-in (server buckets) storage paths.
let mockUser = { uid: 'user-1', isAnonymous: true };

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Built inside the factory: module imports are hoisted above this file's
// top-level consts, so a factory closing over an outer object would capture it
// before it is assigned.
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    createSession: jest.fn(),
    getRecommendations: jest.fn(),
    rerollRecommendations: jest.fn(),
    getBucket: jest.fn(),
    getBuckets: jest.fn(),
    addGameToBucket: jest.fn(),
    removeGameFromBucket: jest.fn(),
    moveGame: jest.fn(),
  },
}));

import mockApi from '../src/services/api';
import {
  SavedGamesProvider,
  useSavedGames,
  BUCKET_TYPES,
} from '../src/context/SavedGamesContext';
import {
  RecommendationProvider,
  useRecommendation,
} from '../src/context/RecommendationContext';

// --- Fake catalog ----------------------------------------------------------

const REJECTED_GAME_ID = 'game-nope';

// 'game-nope' sits last so a default-size response never happens to include it
// — the assertions must fail because of exclusion, not ordering luck.
const CATALOG = [
  { game_id: 'game-alpha', title: 'Alpha' },
  { game_id: 'game-beta', title: 'Beta' },
  { game_id: 'game-gamma', title: 'Gamma' },
  { game_id: REJECTED_GAME_ID, title: 'Nope' },
];

const RESULTS_PER_REQUEST = 2;

/**
 * Stand-in for the recommendation endpoint. Mirrors the server, which strips
 * `excluded_game_ids` before any fallback relaxation, so excluded games can
 * never reappear through a fallback branch.
 */
const respondFromCatalog = ({ excluded_game_ids = [], limit } = {}) => {
  const excluded = new Set(excluded_game_ids);
  const available = CATALOG.filter((g) => !excluded.has(g.game_id));

  return {
    recommendations: available.slice(0, limit ?? RESULTS_PER_REQUEST),
    session_id: 'session-1',
    fallback_applied: false,
    fallback_message: null,
  };
};

// --- Harness ---------------------------------------------------------------

const wrapper = ({ children }) => (
  <SavedGamesProvider>
    <RecommendationProvider>{children}</RecommendationProvider>
  </SavedGamesProvider>
);

const useHarness = () => ({
  saved: useSavedGames(),
  recs: useRecommendation(),
});

const renderHarness = () => renderHook(useHarness, { wrapper });

const gameIdsOf = (response) => response.recommendations.map((r) => r.game_id);

const lastRequest = (mockFn) => mockFn.mock.calls[mockFn.mock.calls.length - 1][0];

describe('Not For Me bucket excludes games from recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'user-1', isAnonymous: true };

    mockApi.createSession.mockResolvedValue({ session_id: 'session-1' });
    mockApi.getRecommendations.mockImplementation(async (req) => respondFromCatalog(req));
    mockApi.rerollRecommendations.mockImplementation(async (req) => respondFromCatalog(req));
    mockApi.addGameToBucket.mockResolvedValue({ game_id: REJECTED_GAME_ID });
    mockApi.removeGameFromBucket.mockResolvedValue({});
    mockApi.getBucket.mockResolvedValue({ games: [], game_count: 0 });
  });

  it('excludes a locally-marked game for anonymous users', async () => {
    const { result } = await renderHarness();
    await waitFor(() => expect(result.current.saved.isInitialized).toBe(true));

    await act(async () => {
      await result.current.saved.addGameToBucket(
        BUCKET_TYPES.NOT_FOR_ME,
        REJECTED_GAME_ID,
        'Nope'
      );
    });

    // Anonymous buckets stay on-device — nothing should have been sent up.
    expect(mockApi.addGameToBucket).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.saved.notForMeGameIds).toContain(REJECTED_GAME_ID)
    );

    let response;
    await act(async () => {
      response = await result.current.recs.getRecommendations();
    });

    expect(lastRequest(mockApi.getRecommendations).excluded_game_ids).toContain(
      REJECTED_GAME_ID
    );
    expect(gameIdsOf(response)).not.toContain(REJECTED_GAME_ID);
  });

  it('excludes a server-side marked game for signed-in users', async () => {
    mockUser = { uid: 'user-1', isAnonymous: false };
    mockApi.getBucket.mockResolvedValue({
      games: [{ game_id: REJECTED_GAME_ID, game_title: 'Nope' }],
      game_count: 1,
    });

    const { result } = await renderHarness();
    await waitFor(() =>
      expect(result.current.saved.notForMeGameIds).toContain(REJECTED_GAME_ID)
    );

    expect(mockApi.getBucket).toHaveBeenCalledWith(BUCKET_TYPES.NOT_FOR_ME, 200, 0);

    let response;
    await act(async () => {
      response = await result.current.recs.getRecommendations();
    });

    expect(lastRequest(mockApi.getRecommendations).excluded_game_ids).toContain(
      REJECTED_GAME_ID
    );
    expect(gameIdsOf(response)).not.toContain(REJECTED_GAME_ID);
  });

  it('excludes on reroll immediately after marking, before the refetch lands', async () => {
    mockUser = { uid: 'user-1', isAnonymous: false };
    mockApi.getBucket
      .mockResolvedValueOnce({ games: [], game_count: 0 }) // initial mount fetch
      .mockImplementation(() => new Promise(() => {})); // refetch never resolves

    const { result } = await renderHarness();
    await waitFor(() => expect(mockApi.getBucket).toHaveBeenCalledTimes(1));

    // Establish a session so reroll doesn't fall back to getRecommendations.
    await act(async () => {
      await result.current.recs.getRecommendations();
    });
    expect(result.current.recs.shownGameIds).not.toContain(REJECTED_GAME_ID);

    await act(async () => {
      await result.current.saved.addGameToBucket(
        BUCKET_TYPES.NOT_FOR_ME,
        REJECTED_GAME_ID,
        'Nope'
      );
    });

    let response;
    await act(async () => {
      response = await result.current.recs.reroll();
    });

    expect(lastRequest(mockApi.rerollRecommendations).excluded_game_ids).toContain(
      REJECTED_GAME_ID
    );
    expect(gameIdsOf(response)).not.toContain(REJECTED_GAME_ID);
  });

  it('stops excluding once the game is moved out of Not For Me', async () => {
    const { result } = await renderHarness();
    await waitFor(() => expect(result.current.saved.isInitialized).toBe(true));

    await act(async () => {
      await result.current.saved.addGameToBucket(
        BUCKET_TYPES.NOT_FOR_ME,
        REJECTED_GAME_ID,
        'Nope'
      );
    });
    await waitFor(() =>
      expect(result.current.saved.notForMeGameIds).toContain(REJECTED_GAME_ID)
    );

    await act(async () => {
      await result.current.saved.moveGame(
        BUCKET_TYPES.NOT_FOR_ME,
        BUCKET_TYPES.BACKLOG,
        REJECTED_GAME_ID
      );
    });
    await waitFor(() =>
      expect(result.current.saved.notForMeGameIds).not.toContain(REJECTED_GAME_ID)
    );

    await act(async () => {
      await result.current.recs.getRecommendations();
    });

    expect(
      lastRequest(mockApi.getRecommendations).excluded_game_ids
    ).not.toContain(REJECTED_GAME_ID);
  });
});
