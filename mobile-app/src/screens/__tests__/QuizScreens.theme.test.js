import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';

const mockPrefs = {
  timeAvailable: 60,
  energyMood: 'focused',
  libraryOnly: false,
  platforms: ['pc'],
  genres: [],
  sessionType: 'any',
  discoveryMode: 'familiar',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
}));
// Record every LinearGradient's props so the tests can read its colors.
const mockGradients = [];
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props) => { mockGradients.push(props); return props.children; },
}));
jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    preferences: mockPrefs,
    updatePreference: jest.fn(),
    getRecommendations: jest.fn(() => Promise.resolve()),
  }),
}));
jest.mock('../../context/PremiumContext', () => ({
  usePremium: () => ({
    isPremium: true,
    dailyRerollCount: 0,
    shouldShowAdBeforeReroll: () => false,
    showRewardedAd: jest.fn(),
    isAdLoading: false,
    hasFeature: () => true,
  }),
}));
jest.mock('../../services/api', () => ({
  getSteamLibraryStatus: jest.fn(() => Promise.resolve({ connected: false })),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import { ThemeProvider } from '../../theme/ThemeContext';
import TimeSelectScreen from '../TimeSelectScreen';
import MoodSelectScreen from '../MoodSelectScreen';
import OptionalFiltersScreen from '../OptionalFiltersScreen';

const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;
const DEFAULT_FLOW = ['#0f0c29', '#302b63', '#24243e'];
const SPOOKY_ORANGE = '#ff8a3d';

const rootColors = () => mockGradients[0].colors;

// Every style value and gradient color the screen rendered, as one string.
const renderedStyleDump = () => {
  const parts = mockGradients.map((g) => JSON.stringify(g.colors));
  const walk = (node) => {
    if (!node || typeof node === 'string') return;
    if (Array.isArray(node)) return node.forEach(walk);
    parts.push(JSON.stringify(StyleSheet.flatten(node.props?.style) ?? {}));
    walk(node.children);
  };
  walk(screen.toJSON());
  return parts.join('\n').toLowerCase();
};

const renderThemed = (Screen) =>
  render(
    <ThemeProvider palette={spooky}>
      <Screen />
    </ThemeProvider>
  );

beforeEach(() => {
  mockGradients.length = 0;
  mockPrefs.energyMood = 'focused';
  mockPrefs.libraryOnly = false;
  mockPrefs.platforms = ['pc'];
});

describe.each([
  ['TimeSelectScreen', TimeSelectScreen],
  ['MoodSelectScreen', MoodSelectScreen],
  ['OptionalFiltersScreen', OptionalFiltersScreen],
])('%s root gradient', (_name, Screen) => {
  it('keeps today\'s flow gradient with no provider', async () => {
    await render(<Screen />);
    expect(rootColors()).toEqual(DEFAULT_FLOW);
  });

  it('uses the season background under Spooky', async () => {
    await renderThemed(Screen);
    expect(rootColors()).toEqual(spooky.bg_gradient);
  });

  it('never uses the season accent on a tappable or chip', async () => {
    await renderThemed(Screen);
    expect(renderedStyleDump()).not.toContain(SPOOKY_ORANGE);
  });
});

describe('TimeSelectScreen', () => {
  const activeLabelColor = () =>
    StyleSheet.flatten(screen.getByText('Anything').props.style).color;

  it('uses dark text on the active pink mode pill (default and Spooky)', async () => {
    await render(<TimeSelectScreen />);
    expect(activeLabelColor()).toBe('#0a0a1a');
  });

  it('keeps the dark pill label under Spooky', async () => {
    await renderThemed(TimeSelectScreen);
    expect(activeLabelColor()).toBe('#0a0a1a');
  });

  it('keeps the selected option tint as brand pink under Spooky', async () => {
    await renderThemed(TimeSelectScreen);
    const tint = mockGradients.find((g) => g.start && g.end);
    expect(tint.colors).toEqual(['rgba(248,87,166,0.2)', 'rgba(255,88,88,0.1)']);
  });
});

describe('MoodSelectScreen', () => {
  it('keeps the mood identity colors on the selected card (default and Spooky)', async () => {
    await render(<MoodSelectScreen />);
    const label = StyleSheet.flatten(screen.getByText('Focused').props.style);
    expect(label.color).toBe('#f59e0b');
    expect(mockGradients.some((g) => g.colors[0] === '#f59e0b30')).toBe(true);
  });

  it('has no element styled with the Spooky orange', async () => {
    await renderThemed(MoodSelectScreen);
    expect(renderedStyleDump()).not.toContain(SPOOKY_ORANGE);
  });
});

describe('OptionalFiltersScreen', () => {
  it('keeps the chip tint and CTA as brand pink under Spooky', async () => {
    await renderThemed(OptionalFiltersScreen);
    const chip = mockGradients.find((g) => g.colors[0] === 'rgba(248,87,166,0.3)');
    expect(chip.colors).toEqual(['rgba(248,87,166,0.3)', 'rgba(255,88,88,0.2)']);
    const cta = mockGradients.find((g) => g.colors[0] === '#f857a6');
    expect(cta.colors).toEqual(['#f857a6', '#ff5858']);
  });

  it('keeps today\'s chip tint with no provider', async () => {
    await render(<OptionalFiltersScreen />);
    expect(mockGradients.some((g) => g.colors[0] === 'rgba(248,87,166,0.3)')).toBe(true);
  });
});
