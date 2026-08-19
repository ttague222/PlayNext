import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FeedbackModal from '../FeedbackModal';

const mockGame = { game_id: 'game-1', title: 'Test Game', description_short: 'A test game' };

describe('FeedbackModal', () => {
  it('calls onSubmit with "worked" when "This worked for me" is pressed', async () => {
    const onSubmit = jest.fn();
    await render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    await fireEvent.press(screen.getByText('This worked for me'));
    expect(onSubmit).toHaveBeenCalledWith('worked');
  });

  it('calls onSubmit with "not_good_fit" when "Not a good fit" is pressed', async () => {
    const onSubmit = jest.fn();
    await render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    await fireEvent.press(screen.getByText('Not a good fit'));
    expect(onSubmit).toHaveBeenCalledWith('not_good_fit');
  });

  it("calls onClose when \"I'll give feedback later\" is pressed", async () => {
    const onClose = jest.fn();
    await render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={jest.fn()} onClose={onClose} />
    );
    await fireEvent.press(screen.getByText("I'll give feedback later"));
    expect(onClose).toHaveBeenCalled();
  });
});
