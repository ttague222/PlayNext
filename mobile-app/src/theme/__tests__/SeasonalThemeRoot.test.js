import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';
import { DEFAULT_THEME } from '../tokens';
import { useTheme } from '../ThemeContext';
import { SeasonalThemeRoot } from '../SeasonalThemeRoot';
import { activeSeason, visibleCollections } from '../../services/seasonalService';

let mockToday = '2026-11-05';
let mockCached;
let mockLoaded;

// Keeps the real seasonal helpers (activeSeason, visibleCollections) off the network client.
jest.mock('../../services/api', () => ({}));

jest.mock('../../services/tonightService', () => ({
  ...jest.requireActual('../../services/tonightService'),
  localDateString: () => mockToday,
}));

jest.mock('../../services/seasonalService', () => ({
  ...jest.requireActual('../../services/seasonalService'),
  getCachedSeasonalContentSync: () => mockCached,
  loadSeasonalContent: jest.fn(() => Promise.resolve(mockLoaded)),
}));

const { loadSeasonalContent } = require('../../services/seasonalService');

// The bundled Harvest palette passes the guardrail; the vectors' harvest palette
// (accent too close to the warning colors) does not.
const SAFE_HARVEST = {
  bg_gradient: ['#120a06', '#2a1610', '#3a2114'],
  bg_decor: '#b5652e',
  accent_season: '#c87941',
  on_accent_season: '#1f1300',
};
const UNSAFE_HARVEST = vectors.palettes.find((p) => p.name === 'harvest').palette;

const contentWith = (palette) => ({
  schema_version: 1,
  seasons: [
    {
      id: 'harvest-2026',
      name: 'Harvest',
      starts: '2026-11-01',
      ends: '2026-11-30',
      palette,
      collections: [
        {
          id: 'harvest-2026-long-weekend',
          title: 'Couch co-op for the long weekend',
          blurb: 'Games you can play together.',
          params: { time_available: 60, energy_mood: 'casual' },
        },
      ],
    },
  ],
});

const EMPTY = { schema_version: 1, seasons: [] };

let themes;
const Probe = () => {
  const theme = useTheme();
  themes.push(theme);
  return <Text>{String(theme.accent.season)}</Text>;
};
const lastTheme = () => themes[themes.length - 1];

let appStateHandler;
let removeAppStateListener;

beforeEach(() => {
  themes = [];
  mockToday = '2026-11-05';
  mockCached = contentWith(SAFE_HARVEST);
  mockLoaded = mockCached;
  loadSeasonalContent.mockClear();
  appStateHandler = undefined;
  removeAppStateListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') appStateHandler = handler;
    return { remove: removeAppStateListener };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderRoot = () =>
  render(
    <SeasonalThemeRoot>
      <Probe />
    </SeasonalThemeRoot>
  );

describe('SeasonalThemeRoot', () => {
  it('applies the active season palette from the first render', async () => {
    await renderRoot();
    expect(themes[0].bg.flow[1]).toBe('#2a1610');
    expect(themes[0].accent.season).toBe('#c87941');
    expect(themes[0].accent.brand).toBe('#f857a6');
  });

  it('keeps the default theme and still shows the card when the palette is unsafe', async () => {
    mockCached = contentWith(UNSAFE_HARVEST);
    mockLoaded = mockCached;
    await renderRoot();
    expect(lastTheme()).toEqual(DEFAULT_THEME);

    const season = activeSeason(mockCached, mockToday);
    expect(visibleCollections(season, mockToday).map((c) => c.id)).toEqual(['harvest-2026-long-weekend']);
  });

  it('uses the default theme outside any season window', async () => {
    mockToday = '2026-10-25';
    await renderRoot();
    expect(lastTheme()).toBe(DEFAULT_THEME);
  });

  it('loads fresh content on mount and switches theme when it changes the season', async () => {
    mockCached = EMPTY;
    mockLoaded = contentWith(SAFE_HARVEST);
    await renderRoot();
    expect(themes[0]).toBe(DEFAULT_THEME);
    expect(loadSeasonalContent).toHaveBeenCalledTimes(1);
    expect(lastTheme().accent.season).toBe('#c87941');
  });

  it('recomputes the active season when the app returns to the foreground', async () => {
    await renderRoot();
    expect(lastTheme().accent.season).toBe('#c87941');

    mockToday = '2026-12-02'; // past the end of Harvest, no season covers it
    await act(async () => {
      appStateHandler('active');
    });
    expect(loadSeasonalContent).toHaveBeenCalledTimes(2);
    expect(lastTheme()).toBe(DEFAULT_THEME);
  });

  it('ignores background and inactive transitions', async () => {
    await renderRoot();
    await act(async () => {
      appStateHandler('background');
      appStateHandler('inactive');
    });
    expect(loadSeasonalContent).toHaveBeenCalledTimes(1);
  });

  it('keeps the same theme object when a reload returns an equal palette', async () => {
    await renderRoot();
    const before = lastTheme();
    mockLoaded = contentWith({ ...SAFE_HARVEST, bg_gradient: [...SAFE_HARVEST.bg_gradient] });
    await act(async () => {
      appStateHandler('active');
    });
    expect(lastTheme()).toBe(before);
  });

  it('removes the AppState listener on unmount', async () => {
    const { unmount } = await renderRoot();
    await unmount();
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
  });
});
