import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve(null)), // covers render without art
}));

import TonightCard, { formatContextLine } from '../TonightCard';

const CONTEXT = { timeAvailable: 60, energyMood: 'wind_down', genres: [], platforms: [], sessionType: 'solo', discoveryMode: 'familiar' };
const GAMES = [
  { game_id: 'hades', title: 'Hades' },
  { game_id: 'celeste', title: 'Celeste' },
  { game_id: 'unpacking', title: 'Unpacking' },
];

describe('formatContextLine', () => {
  it('formats time and mood', () => {
    expect(formatContextLine(CONTEXT)).toBe('60 min · Wind down');
    expect(formatContextLine({ timeAvailable: 120, energyMood: 'intense' })).toBe('2+ hrs · Intense');
  });
  it('is safe on unknown mood values', () => {
    expect(formatContextLine({ timeAvailable: 30, energyMood: 'mystery' })).toBe('30 min · mystery');
  });
});

describe('TonightCard', () => {
  it('renders title, context line, and games when ready', async () => {
    const { getByText } = await render(
      <TonightCard status="ready" context={CONTEXT} games={GAMES} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Tonight's Picks");
    getByText('60 min · Wind down');
    getByText('Hades');
    getByText('Celeste');
    getByText('Unpacking');
  });

  it('fires onPress and onChangePress', async () => {
    const onPress = jest.fn();
    const onChangePress = jest.fn();
    const { getByTestId, getByText } = await render(
      <TonightCard status="ready" context={CONTEXT} games={GAMES} onPress={onPress} onChangePress={onChangePress} />
    );
    await fireEvent.press(getByTestId('tonight-card'));
    expect(onPress).toHaveBeenCalled();
    await fireEvent.press(getByText('Change'));
    expect(onChangePress).toHaveBeenCalled();
  });

  it('renders the loading state', async () => {
    const { getByText, queryByText } = await render(
      <TonightCard status="loading" context={CONTEXT} games={[]} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Tonight's Picks");
    getByText('Picking for tonight…');
    expect(queryByText('Hades')).toBeNull();
  });

  it('renders the error state with retry copy', async () => {
    const { getByText } = await render(
      <TonightCard status="error" context={CONTEXT} games={[]} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Couldn't load tonight's picks. Tap to retry.");
  });
});
