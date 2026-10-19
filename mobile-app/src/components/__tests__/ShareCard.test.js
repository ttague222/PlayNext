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

const threePicks = [
  game,
  {
    title: 'Unpacking',
    explanation: { mood_fit: 'Zen box-by-box pace that asks nothing of you.' },
    match_score: 0.88,
  },
  {
    title: 'Celeste',
    explanation: { summary: 'Short chapters land inside your window. Hard but fair.' },
    match_score: 0.84,
  },
];

describe('ShareCard', () => {
  it('renders a single pick with its reasoning and badges', async () => {
    await render(<ShareCard picks={[game]} />);
    expect(screen.getByText('Hades')).toBeTruthy();
    expect(screen.getByText('A full escape attempt fits your window.')).toBeTruthy();
    expect(screen.getByText('⚡ Jump right in')).toBeTruthy();
    expect(screen.getByText('✋ Stop anytime')).toBeTruthy();
    expect(screen.getByText('On Game Pass')).toBeTruthy();
  });

  it('renders all three picks with their why lines', async () => {
    await render(<ShareCard picks={threePicks} timeAvailable={30} energyMood="wind_down" />);
    expect(screen.getByText('Hades')).toBeTruthy();
    expect(screen.getByText('Unpacking')).toBeTruthy();
    expect(screen.getByText('Celeste')).toBeTruthy();
    expect(screen.getByText('A full escape attempt fits your window.')).toBeTruthy();
    expect(screen.getByText('Zen box-by-box pace that asks nothing of you.')).toBeTruthy();
    expect(
      screen.getByText('Short chapters land inside your window. Hard but fair.')
    ).toBeTruthy();
  });

  it('drops the per-game badges when showing the full set', async () => {
    // Three picks on one 1080x1350 card leave no room for badge rows.
    await render(<ShareCard picks={threePicks} />);
    expect(screen.queryByText('⚡ Jump right in')).toBeNull();
    expect(screen.queryByText('On Game Pass')).toBeNull();
  });

  it('headlines the set, not a single pick, when there are several', async () => {
    await render(<ShareCard picks={threePicks} />);
    expect(screen.getByText("TONIGHT'S PICKS")).toBeTruthy();
    await render(<ShareCard picks={[game]} />);
    expect(screen.getByText("TONIGHT'S PICK")).toBeTruthy();
  });

  it('shows context chips when time and mood are provided', async () => {
    await render(<ShareCard picks={[game]} timeAvailable={30} energyMood="focused" />);
    expect(screen.getByText('⏱ 30 min')).toBeTruthy();
    expect(screen.getByText('🎯 Focused')).toBeTruthy();
  });

  it('omits chips without session context', async () => {
    await render(<ShareCard picks={[game]} />);
    expect(screen.queryByText(/30 min/)).toBeNull();
  });

  it('always carries the PlayNxt branding footer', async () => {
    await render(<ShareCard picks={[{ title: 'Celeste' }]} />);
    expect(screen.getByText('playnxt.io')).toBeTruthy();
    expect(screen.getByText('What to play, in your free time')).toBeTruthy();
  });
});
