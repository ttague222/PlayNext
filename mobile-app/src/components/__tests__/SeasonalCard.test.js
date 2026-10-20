import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }) => children ?? null }));
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve({ imageUrl: null, fallbackColors: ['#1a1a2e', '#16213e'] })),
}));

import { ThemeProvider } from '../../theme/ThemeContext';
import { DEFAULT_THEME } from '../../theme/tokens';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';
import SeasonalCard, { formatCollectionContext } from '../SeasonalCard';

const COLLECTION = {
  id: 'harvest-2026-long-weekend',
  title: 'Couch co-op for the long weekend',
  blurb: 'Everyone is home and there is room on the couch.',
  params: { time_available: 60, energy_mood: 'casual', session_type: 'couch_coop' },
};
const PICKS = {
  date: '2026-11-05',
  collectionId: COLLECTION.id,
  sessionId: 's1',
  games: [
    { game_id: 'hades', title: 'Hades' },
    { game_id: 'celeste', title: 'Celeste' },
    { game_id: 'unpacking', title: 'Unpacking' },
  ],
  fallbackApplied: false,
  fallbackMessage: null,
};

const renderCard = (props = {}) =>
  render(
    <SeasonalCard
      collection={COLLECTION}
      picks={PICKS}
      status="ready"
      onPress={jest.fn()}
      onRetry={jest.fn()}
      {...props}
    />
  );

describe('formatCollectionContext', () => {
  it('formats minutes, mood and session type', () => {
    expect(formatCollectionContext(COLLECTION.params)).toBe('60 min · Casual · Couch co-op');
  });

  it('labels every mood and session type', () => {
    const line = (energy_mood, session_type) =>
      formatCollectionContext({ time_available: 30, energy_mood, session_type });
    expect(line('wind_down', 'solo')).toBe('30 min · Wind Down · Solo');
    expect(line('focused', 'multiplayer')).toBe('30 min · Focused · With friends');
    expect(line('intense', 'online_friends')).toBe('30 min · Intense · Online with friends');
  });

  it('omits the session part for any or missing', () => {
    expect(formatCollectionContext({ time_available: 120, energy_mood: 'casual', session_type: 'any' })).toBe('120 min · Casual');
    expect(formatCollectionContext({ time_available: 120, energy_mood: 'casual' })).toBe('120 min · Casual');
  });

  it('is safe on unknown mood values', () => {
    expect(formatCollectionContext({ time_available: 30, energy_mood: 'mystery' })).toBe('30 min · mystery');
  });
});

describe('SeasonalCard', () => {
  it('renders title, blurb, context line and three thumbnails when ready', async () => {
    const { getByText } = await renderCard();
    getByText('Couch co-op for the long weekend');
    getByText('Everyone is home and there is room on the couch.');
    getByText('60 min · Casual · Couch co-op');
    getByText('Hades');
    getByText('Celeste');
    getByText('Unpacking');
  });

  it('shows the season name as the eyebrow when given', async () => {
    const { getByText } = await renderCard({ seasonName: 'Harvest' });
    getByText('Harvest');
  });

  it('presses through while loading, with no thumbnails', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = await renderCard({ status: 'loading', picks: null, onPress });
    expect(queryByText('Hades')).toBeNull();
    await fireEvent.press(getByTestId(`seasonal-card-${COLLECTION.id}`));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows retry text on error and retries without opening the card', async () => {
    const onPress = jest.fn();
    const onRetry = jest.fn();
    const { getByText } = await renderCard({ status: 'error', picks: null, onPress, onRetry });
    getByText("Couldn't load today's picks.");
    await fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the optional header image with its alt text', async () => {
    const { getByLabelText } = await renderCard({ headerImage: { url: 'https://example.com/h.png', alt: 'Falling leaves' } });
    getByLabelText('Falling leaves');
  });

  it('renders no header image by default', async () => {
    const { queryByTestId } = await renderCard();
    expect(queryByTestId('seasonal-card-header-image')).toBeNull();
  });

  describe('theming', () => {
    const flatten = (style) => StyleSheet.flatten(style);
    const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;

    it('uses the brand color for the border and eyebrow in the default theme', async () => {
      const { getByTestId, getByText } = await renderCard({ seasonName: 'Harvest' });
      const border = flatten(getByTestId(`seasonal-card-${COLLECTION.id}`).props.style).borderColor;
      expect(border).toBe('rgba(248,87,166,0.25)');
      expect(flatten(getByText('Harvest').props.style).color).toBe(DEFAULT_THEME.accent.brand);
    });

    it('uses the season accent for the border and eyebrow, but keeps Retry brand pink', async () => {
      const { getByTestId, getByText } = await render(
        <ThemeProvider palette={spooky}>
          <SeasonalCard
            collection={COLLECTION}
            picks={null}
            status="error"
            seasonName="Harvest"
            onPress={jest.fn()}
            onRetry={jest.fn()}
          />
        </ThemeProvider>
      );
      const border = flatten(getByTestId(`seasonal-card-${COLLECTION.id}`).props.style).borderColor;
      expect(border).toBe('rgba(255,138,61,0.25)');
      expect(flatten(getByText('Harvest').props.style).color).toBe(spooky.accent_season);
      expect(flatten(getByText('Retry').props.style).color).toBe(DEFAULT_THEME.accent.brand);
    });
  });
});
