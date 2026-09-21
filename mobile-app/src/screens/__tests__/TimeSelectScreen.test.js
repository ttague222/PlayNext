import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TimeSelectScreen from '../TimeSelectScreen';
import api from '../../services/api';

const mockNavigate = jest.fn();
const mockUpdatePreference = jest.fn();
let mockPreferences;
let mockIsPremium;
let mockFocusListeners;

jest.mock('../../services/api', () => ({
  getSteamLibraryStatus: jest.fn(),
}));

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    addListener: (event, cb) => {
      mockFocusListeners.push(cb);
      return jest.fn();
    },
  }),
}));

jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    preferences: mockPreferences,
    updatePreference: mockUpdatePreference,
  }),
}));

jest.mock('../../context/PremiumContext', () => ({
  usePremium: () => ({ isPremium: mockIsPremium }),
}));

// Fire the navigator focus event and flush the status fetch's promise chain
const fireFocus = () =>
  act(async () => {
    mockFocusListeners.forEach((cb) => cb());
  });

describe('TimeSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners = [];
    mockPreferences = { timeAvailable: null, libraryOnly: false };
    mockIsPremium = false;
    api.getSteamLibraryStatus.mockResolvedValue({ connected: false });
  });

  it('selecting a time saves it and advances to mood', async () => {
    await render(<TimeSelectScreen />);
    await fireEvent.press(screen.getByText('30 min'));
    expect(mockUpdatePreference).toHaveBeenCalledWith('timeAvailable', 30);
    expect(mockNavigate).toHaveBeenCalledWith('MoodSelect');
  });

  it('shows the backlog toggle with a lock for free users', async () => {
    await render(<TimeSelectScreen />);
    expect(screen.getByText('Anything')).toBeTruthy();
    expect(screen.getByText('My backlog')).toBeTruthy();
  });

  it('free user tapping My backlog opens the premium sheet, not the mode', async () => {
    await render(<TimeSelectScreen />);
    await fireEvent.press(screen.getByText('My backlog'));
    expect(mockNavigate).toHaveBeenCalledWith('Premium');
    expect(mockUpdatePreference).not.toHaveBeenCalledWith('libraryOnly', true);
  });

  it('premium user without a synced library is routed to Connect Steam', async () => {
    mockIsPremium = true;
    api.getSteamLibraryStatus.mockResolvedValue({ connected: false });

    await render(<TimeSelectScreen />);
    await fireFocus();
    await waitFor(() => expect(api.getSteamLibraryStatus).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('My backlog'));
    expect(mockNavigate).toHaveBeenCalledWith('ConnectSteam');
    expect(mockUpdatePreference).not.toHaveBeenCalledWith('libraryOnly', true);
  });

  it('premium user with a synced library enables Backlog Mode', async () => {
    mockIsPremium = true;
    api.getSteamLibraryStatus.mockResolvedValue({ connected: true });

    await render(<TimeSelectScreen />);
    await fireFocus();
    await waitFor(() => expect(api.getSteamLibraryStatus).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('My backlog'));
    expect(mockUpdatePreference).toHaveBeenCalledWith('libraryOnly', true);
    expect(mockNavigate).not.toHaveBeenCalledWith('ConnectSteam');
    expect(mockNavigate).not.toHaveBeenCalledWith('Premium');
  });

  it('tapping Anything turns Backlog Mode off', async () => {
    mockPreferences = { timeAvailable: null, libraryOnly: true };
    await render(<TimeSelectScreen />);
    await fireEvent.press(screen.getByText('Anything'));
    expect(mockUpdatePreference).toHaveBeenCalledWith('libraryOnly', false);
  });

  it('shows the backlog hint only when the mode is on', async () => {
    mockPreferences = { timeAvailable: null, libraryOnly: true };
    await render(<TimeSelectScreen />);
    expect(screen.getByText('Picking from your unplayed Steam games')).toBeTruthy();
  });

  it('does not fetch library status for free users', async () => {
    await render(<TimeSelectScreen />);
    await fireFocus();
    expect(api.getSteamLibraryStatus).not.toHaveBeenCalled();
  });
});
