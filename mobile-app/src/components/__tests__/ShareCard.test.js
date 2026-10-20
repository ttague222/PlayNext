import React from 'react';
import { render, screen } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';
import { ThemeProvider } from '../../theme/ThemeContext';
import ShareCard from '../ShareCard';

// Record every LinearGradient's props so the tests can read its colors.
const mockGradients = [];
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props) => { mockGradients.push(props); return props.children; },
}));

const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;

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

describe('ShareCard background', () => {
  beforeEach(() => {
    mockGradients.length = 0;
  });

  it('renders the share gradient without a ThemeProvider', async () => {
    await render(<ShareCard picks={[game]} />);
    expect(mockGradients[0].colors).toEqual(['#0f0c29', '#1a1a2e', '#16213e']);
  });

  it('keeps the share gradient under a seasonal theme (the shared image never changes with the season)', async () => {
    await render(
      <ThemeProvider palette={spooky}>
        <ShareCard picks={[game]} />
      </ThemeProvider>
    );
    expect(mockGradients[0].colors).toEqual(['#0f0c29', '#1a1a2e', '#16213e']);
  });
});
