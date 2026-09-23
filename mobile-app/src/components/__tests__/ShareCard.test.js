import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ShareCard from '../ShareCard';

const game = {
  title: 'Hades',
  explanation: { summary: 'A full escape attempt fits your window.' },
  time_to_fun: 'short',
  stop_friendliness: 'anytime',
  subscription_services: ['xbox_game_pass'],
};

describe('ShareCard', () => {
  it('renders the pick with its reasoning and badges', async () => {
    await render(<ShareCard game={game} />);
    expect(screen.getByText('Hades')).toBeTruthy();
    expect(screen.getByText('A full escape attempt fits your window.')).toBeTruthy();
    expect(screen.getByText('⚡ Jump right in')).toBeTruthy();
    expect(screen.getByText('✋ Stop anytime')).toBeTruthy();
    expect(screen.getByText('On Game Pass')).toBeTruthy();
  });

  it('shows context chips when time and mood are provided', async () => {
    await render(<ShareCard game={game} timeAvailable={30} energyMood="focused" />);
    expect(screen.getByText('⏱ 30 min')).toBeTruthy();
    expect(screen.getByText('🎯 Focused')).toBeTruthy();
  });

  it('omits chips without session context', async () => {
    await render(<ShareCard game={game} />);
    expect(screen.queryByText(/30 min/)).toBeNull();
  });

  it('always carries the PlayNxt branding footer', async () => {
    await render(<ShareCard game={{ title: 'Celeste' }} />);
    expect(screen.getByText('playnxt.io')).toBeTruthy();
    expect(screen.getByText('What to play, in your free time')).toBeTruthy();
  });
});
