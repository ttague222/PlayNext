import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import WhatsNewScreen from '../WhatsNewScreen';
import api from '../../services/api';

jest.mock('../../services/api', () => ({
  getRecentGames: jest.fn(),
  getUpcomingGames: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

const recentGame = {
  game_id: 'game-1',
  title: 'Recent Game',
  platforms: ['pc'],
  description_short: 'A recently added game',
};

const upcomingGame = {
  game_id: 'game-2',
  title: 'Upcoming Game',
  platforms: ['pc'],
  release_date: '2026-10-01',
};

describe('WhatsNewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Coming Soon section when upcoming games are returned', async () => {
    api.getRecentGames.mockResolvedValue([recentGame]);
    api.getUpcomingGames.mockResolvedValue([upcomingGame]);

    await render(<WhatsNewScreen />);

    await waitFor(() => expect(screen.getByText('Recent Game')).toBeTruthy());
    expect(screen.getByText('Coming Soon')).toBeTruthy();
    expect(screen.getByText('Upcoming Game')).toBeTruthy();
  });

  it('does not render the Coming Soon section when there are no upcoming games', async () => {
    api.getRecentGames.mockResolvedValue([recentGame]);
    api.getUpcomingGames.mockResolvedValue([]);

    await render(<WhatsNewScreen />);

    await waitFor(() => expect(screen.getByText('Recent Game')).toBeTruthy());
    expect(screen.queryByText('Coming Soon')).toBeNull();
  });

  it('announced-only case: shows the empty-state message and still shows the Coming Soon footer', async () => {
    api.getRecentGames.mockResolvedValue([]);
    api.getUpcomingGames.mockResolvedValue([upcomingGame]);

    await render(<WhatsNewScreen />);

    await waitFor(() =>
      expect(screen.getByText('No new games this week — check back soon.')).toBeTruthy()
    );
    expect(screen.getByText('Coming Soon')).toBeTruthy();
    expect(screen.getByText('Upcoming Game')).toBeTruthy();
  });
});
