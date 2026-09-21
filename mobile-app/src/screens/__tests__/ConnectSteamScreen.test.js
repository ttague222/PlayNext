import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ConnectSteamScreen from '../ConnectSteamScreen';
import api from '../../services/api';

jest.mock('../../services/api', () => ({
  getSteamLibraryStatus: jest.fn(),
  syncSteamLibrary: jest.fn(),
  disconnectSteamLibrary: jest.fn(),
}));

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

const disconnectedStatus = {
  connected: false,
  total_count: 0,
  matched_count: 0,
  played_count: 0,
};

const connectedStatus = {
  connected: true,
  steam_id: '76561198000000001',
  synced_at: '2026-09-21T12:00:00Z',
  total_count: 212,
  matched_count: 143,
  played_count: 87,
};

describe('ConnectSteamScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the connect pitch when no library is synced', async () => {
    api.getSteamLibraryStatus.mockResolvedValue(disconnectedStatus);
    await render(<ConnectSteamScreen />);
    await waitFor(() =>
      expect(screen.getByText("Stop seeing games you've already played")).toBeTruthy()
    );
    expect(screen.getByText('Sync my library')).toBeTruthy();
  });

  it('shows match counts when a library is synced', async () => {
    api.getSteamLibraryStatus.mockResolvedValue(connectedStatus);
    await render(<ConnectSteamScreen />);
    await waitFor(() => expect(screen.getByText('Steam connected')).toBeTruthy());
    expect(
      screen.getByText('143 of 212 games matched to our catalog')
    ).toBeTruthy();
    expect(screen.getByText('Re-sync library')).toBeTruthy();
    expect(screen.getByText('Disconnect Steam')).toBeTruthy();
  });

  it('syncs the entered profile and refreshes status', async () => {
    api.getSteamLibraryStatus
      .mockResolvedValueOnce(disconnectedStatus)
      .mockResolvedValueOnce(connectedStatus);
    api.syncSteamLibrary.mockResolvedValue({
      steam_id: connectedStatus.steam_id,
      total_count: 212,
      matched_count: 143,
      played_count: 87,
    });

    await render(<ConnectSteamScreen />);
    await waitFor(() => expect(screen.getByText('Sync my library')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText('steamcommunity.com/id/yourname'),
      'steamcommunity.com/id/tester'
    );
    await fireEvent.press(screen.getByText('Sync my library'));

    await waitFor(() =>
      expect(api.syncSteamLibrary).toHaveBeenCalledWith('steamcommunity.com/id/tester')
    );
    await waitFor(() => expect(screen.getByText('Steam connected')).toBeTruthy());
  });

  it('shows the API error detail when a sync fails', async () => {
    api.getSteamLibraryStatus.mockResolvedValue(disconnectedStatus);
    api.syncSteamLibrary.mockRejectedValue({
      response: { status: 400, data: { detail: 'This Steam profile is private.' } },
    });

    await render(<ConnectSteamScreen />);
    await waitFor(() => expect(screen.getByText('Sync my library')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText('steamcommunity.com/id/yourname'),
      'someone'
    );
    await fireEvent.press(screen.getByText('Sync my library'));

    await waitFor(() =>
      expect(screen.getByText('This Steam profile is private.')).toBeTruthy()
    );
  });

  it('requires input before syncing when not connected', async () => {
    api.getSteamLibraryStatus.mockResolvedValue(disconnectedStatus);
    await render(<ConnectSteamScreen />);
    await waitFor(() => expect(screen.getByText('Sync my library')).toBeTruthy());

    await fireEvent.press(screen.getByText('Sync my library'));

    expect(api.syncSteamLibrary).not.toHaveBeenCalled();
    expect(screen.getByText('Paste your Steam profile URL first')).toBeTruthy();
  });

  it('re-syncs the stored profile when input is left empty', async () => {
    api.getSteamLibraryStatus.mockResolvedValue(connectedStatus);
    api.syncSteamLibrary.mockResolvedValue({
      steam_id: connectedStatus.steam_id,
      total_count: 212,
      matched_count: 143,
      played_count: 87,
    });

    await render(<ConnectSteamScreen />);
    await waitFor(() => expect(screen.getByText('Re-sync library')).toBeTruthy());

    await fireEvent.press(screen.getByText('Re-sync library'));

    await waitFor(() =>
      expect(api.syncSteamLibrary).toHaveBeenCalledWith(connectedStatus.steam_id)
    );
  });
});
