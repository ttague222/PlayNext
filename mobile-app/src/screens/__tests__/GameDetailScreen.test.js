import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GameDetailScreen from '../GameDetailScreen';
import api from '../../services/api';

jest.mock('../../services/api', () => ({
  getGame: jest.fn(),
  getGameRating: jest.fn(),
  setGameRating: jest.fn(),
}));

jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn().mockResolvedValue({ imageUrl: null, fallbackColors: ['#111', '#222'] }),
}));

jest.mock('../../services/affiliateService', () => ({
  generateStoreAffiliateLink: jest.fn(),
  generateSubscriptionAffiliateLink: jest.fn(),
  trackAffiliateClick: jest.fn(),
}));

jest.mock('../../services/shareService', () => ({
  shareGameCard: jest.fn(),
}));

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('../../utils/haptics', () => ({
  hapticLight: jest.fn(),
}));

jest.mock('../../context/SavedGamesContext', () => ({
  ...jest.requireActual('../../context/SavedGamesContext'),
  useSavedGames: () => ({ moveGame: jest.fn(), removeGameFromBucket: jest.fn() }),
}));

jest.mock('../../components/ShareCard', () => {
  const ReactActual = require('react');
  return ReactActual.forwardRef((props, ref) => null);
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: { gameId: 'game-1', gameTitle: 'Test Game', bucketType: null } }),
}));

const releasedGame = {
  title: 'Test Game',
  platforms: ['pc'],
  release_date: '2020-01-01',
};

const zeroRating = { up: 0, down: 0, total: 0, percent_liked: null, user_rating: null };

describe('GameDetailScreen rating toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getGame.mockResolvedValue(releasedGame);
    api.getGameRating.mockResolvedValue(zeroRating);
  });

  it('pressing thumbs-up calls setGameRating with "up"', async () => {
    api.setGameRating.mockResolvedValue({ ...zeroRating, up: 1, total: 1, user_rating: 'up' });
    await render(<GameDetailScreen />);
    await waitFor(() => expect(screen.getByLabelText('Thumbs up')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Thumbs up'));

    await waitFor(() =>
      expect(api.setGameRating).toHaveBeenCalledWith('game-1', 'up', 'Test Game')
    );
  });

  it('pressing thumbs-up again calls setGameRating with null', async () => {
    api.setGameRating
      .mockResolvedValueOnce({ ...zeroRating, up: 1, total: 1, user_rating: 'up' })
      .mockResolvedValueOnce(zeroRating);
    await render(<GameDetailScreen />);
    await waitFor(() => expect(screen.getByLabelText('Thumbs up')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Thumbs up'));
    await waitFor(() =>
      expect(api.setGameRating).toHaveBeenNthCalledWith(1, 'game-1', 'up', 'Test Game')
    );

    await fireEvent.press(screen.getByLabelText('Thumbs up'));
    await waitFor(() =>
      expect(api.setGameRating).toHaveBeenNthCalledWith(2, 'game-1', null, 'Test Game')
    );
  });
});
