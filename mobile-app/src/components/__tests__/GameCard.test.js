import React from 'react';
import { render } from '@testing-library/react-native';
import GameCard from '../GameCard';

const game = {
  game_id: 'g1',
  title: 'Game Dev Tycoon',
  platforms: ['mobile'],
  description_short: 'Build a game development company.',
  explanation: {
    summary: 's',
    style_fit: 'Sim management with real depth.',
    stop_fit: 'Auto-saves between decisions.',
    mood_fit: null,
    time_fit: null,
    session_fit: null,
    library_fit: null,
  },
  time_to_fun: 'short',
  stop_friendliness: 'anytime',
  subscription_services: ['netflix_games'],
  store_links: { ios: 'https://x', android: 'https://y' },
  match_score: 1,
  in_library: false,
};

const renderCard = (overrides = {}) =>
  render(
    <GameCard
      game={game}
      rank={1}
      onAccept={jest.fn()}
      onAlreadyPlayed={jest.fn()}
      onNotForMe={jest.fn()}
      onSave={jest.fn()}
      {...overrides}
    />
  );

describe('GameCard (1.5.0 refresh)', () => {
  it('renders the CTA before the explanation section (P0.1)', async () => {
    const { toJSON } = await renderCard();
    const s = JSON.stringify(toJSON());
    expect(s.indexOf('card-cta')).toBeGreaterThan(-1);
    expect(s.indexOf('card-why')).toBeGreaterThan(-1);
    expect(s.indexOf('card-cta')).toBeLessThan(s.indexOf('card-why'));
  });

  it('shows the match percent in the title row so it survives scrolling (P0.1)', async () => {
    const { getByTestId } = await renderCard();
    expect(getByTestId('match-pill')).toHaveTextContent('100% match');
  });

  it('merges commerce into one WHERE TO PLAY section (P0.3)', async () => {
    const { getByText, queryByText } = await renderCard();
    expect(getByText('WHERE TO PLAY')).toBeTruthy();
    expect(queryByText('Play with subscription')).toBeNull();
    expect(queryByText('Where to buy')).toBeNull();
    // Store chips actually render for the fixture's real STORE_CONFIG keys
    expect(getByText('App Store')).toBeTruthy();
  });

  it('drops the Jump right in / Stop anytime chips (P0.4)', async () => {
    const { queryByText } = await renderCard();
    expect(queryByText(/Jump right in|Quick start/)).toBeNull();
    expect(queryByText(/Stop anytime|Flexible/)).toBeNull();
  });

  it('keeps the In your library chip when owned (P0.4)', async () => {
    const { getByText } = await renderCard({ game: { ...game, in_library: true } });
    expect(getByText('In your library')).toBeTruthy();
  });

  it('labels all three secondary actions (P0.5)', async () => {
    const { getByText } = await renderCard();
    expect(getByText('Played it')).toBeTruthy();
    expect(getByText('Not for me')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('renders exactly the two bullets the API sent (style_fit + stop_fit)', async () => {
    const { getByText } = await renderCard();
    expect(getByText('Sim management with real depth.')).toBeTruthy();
    expect(getByText('Auto-saves between decisions.')).toBeTruthy();
  });

  it('renders time_fit and session_fit rows when the API sends them (forward-compat)', async () => {
    const { getByText } = await renderCard({
      game: {
        ...game,
        explanation: {
          summary: 's',
          style_fit: null,
          stop_fit: null,
          mood_fit: null,
          time_fit: 'Fits a focused 60-minute session.',
          session_fit: 'One run takes about 25 minutes.',
          library_fit: null,
        },
      },
    });
    expect(getByText('Fits a focused 60-minute session.')).toBeTruthy();
    expect(getByText('One run takes about 25 minutes.')).toBeTruthy();
  });
});
