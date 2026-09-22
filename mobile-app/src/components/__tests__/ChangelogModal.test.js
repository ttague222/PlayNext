import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ChangelogModal from '../ChangelogModal';

const mockEntry = {
  title: "What's new in PlayNxt",
  features: [
    {
      icon: 'logo-steam',
      headline: 'Steam library sync',
      body: "Connect Steam to stop seeing games you've already played.",
      cta: { label: 'Connect Steam', screen: 'ConnectSteam' },
    },
    {
      icon: 'albums-outline',
      headline: 'Backlog Mode',
      body: 'Premium: get picks from games you own but never touched.',
      cta: { label: 'Try Backlog Mode', screen: 'Premium' },
    },
  ],
};

describe('ChangelogModal', () => {
  it('renders entry features', async () => {
    await render(
      <ChangelogModal visible={true} entry={mockEntry} onFeaturePress={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(screen.getByText("What's new in PlayNxt")).toBeTruthy();
    expect(screen.getByText('Steam library sync')).toBeTruthy();
    expect(screen.getByText("Connect Steam to stop seeing games you've already played.")).toBeTruthy();
    expect(screen.getByText('Backlog Mode')).toBeTruthy();
  });

  it('calls onFeaturePress with that feature\'s cta when its CTA is pressed', async () => {
    const onFeaturePress = jest.fn();
    await render(
      <ChangelogModal visible={true} entry={mockEntry} onFeaturePress={onFeaturePress} onDismiss={jest.fn()} />
    );
    await fireEvent.press(screen.getByText('Try Backlog Mode →'));
    expect(onFeaturePress).toHaveBeenCalledWith(mockEntry.features[1].cta);
  });

  it('calls onDismiss when "Got it" is pressed', async () => {
    const onDismiss = jest.fn();
    await render(
      <ChangelogModal visible={true} entry={mockEntry} onFeaturePress={jest.fn()} onDismiss={onDismiss} />
    );
    await fireEvent.press(screen.getByText('Got it'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders null without entry', async () => {
    const { toJSON } = await render(
      <ChangelogModal visible={true} entry={null} onFeaturePress={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
