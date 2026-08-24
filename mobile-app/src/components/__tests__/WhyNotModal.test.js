import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WhyNotModal from '../WhyNotModal';

const mockGame = {
  game_id: 'game-1',
  title: 'Test Game',
  explanation: { mood_fit: 'Chill vibes for a casual mood' },
};

describe('WhyNotModal', () => {
  it('shows why the game was picked', async () => {
    await render(
      <WhyNotModal
        visible={true}
        game={mockGame}
        onReason={jest.fn()}
        onAlreadyPlayed={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(screen.getByText('Chill vibes for a casual mood')).toBeTruthy();
  });

  it.each([
    ['Not my kind of game', 'not_my_genre'],
    ['Too big a commitment', 'too_long'],
    ["Doesn't look fun to me", 'not_interesting'],
  ])('calls onReason with the reason id for "%s"', async (label, reasonId) => {
    const onReason = jest.fn();
    await render(
      <WhyNotModal
        visible={true}
        game={mockGame}
        onReason={onReason}
        onAlreadyPlayed={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    await fireEvent.press(screen.getByText(label));
    expect(onReason).toHaveBeenCalledWith(reasonId);
  });

  it('routes "already played" to its own handler, not a rejection', async () => {
    const onReason = jest.fn();
    const onAlreadyPlayed = jest.fn();
    await render(
      <WhyNotModal
        visible={true}
        game={mockGame}
        onReason={onReason}
        onAlreadyPlayed={onAlreadyPlayed}
        onSkip={jest.fn()}
      />
    );
    await fireEvent.press(screen.getByText("I've already played it"));
    expect(onAlreadyPlayed).toHaveBeenCalled();
    expect(onReason).not.toHaveBeenCalled();
  });

  it('calls onSkip for the soft skip', async () => {
    const onSkip = jest.fn();
    await render(
      <WhyNotModal
        visible={true}
        game={mockGame}
        onReason={jest.fn()}
        onAlreadyPlayed={jest.fn()}
        onSkip={onSkip}
      />
    );
    await fireEvent.press(screen.getByText('Just show me something else'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('renders nothing without a game', async () => {
    const { toJSON } = await render(
      <WhyNotModal
        visible={true}
        game={null}
        onReason={jest.fn()}
        onAlreadyPlayed={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(toJSON()).toBeNull();
  });
});
