import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FeedbackModal from '../FeedbackModal';

const mockGame = { game_id: 'game-1', title: 'Test Game', description_short: 'A test game' };

describe('FeedbackModal', () => {
  it('calls onSubmit with "worked" when "This worked for me" is pressed', () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('This worked for me'));
    expect(onSubmit).toHaveBeenCalledWith('worked');
  });

  it('calls onSubmit with "not_good_fit" when "Not a good fit" is pressed', () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('Not a good fit'));
    expect(onSubmit).toHaveBeenCalledWith('not_good_fit');
  });

  it("calls onClose when \"I'll give feedback later\" is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={jest.fn()} onClose={onClose} />
    );
    fireEvent.press(getByText("I'll give feedback later"));
    expect(onClose).toHaveBeenCalled();
  });
});
