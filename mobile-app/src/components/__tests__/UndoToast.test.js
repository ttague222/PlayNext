import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import UndoToast from '../UndoToast';

describe('UndoToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the message and calls onUndo when UNDO is pressed', async () => {
    const onUndo = jest.fn();
    await render(
      <UndoToast
        visible={true}
        message='"Dark Souls" marked not for you'
        onUndo={onUndo}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText('"Dark Souls" marked not for you')).toBeTruthy();
    await fireEvent.press(screen.getByText('UNDO'));
    expect(onUndo).toHaveBeenCalled();
  });

  it('auto-dismisses after the timeout', async () => {
    const onDismiss = jest.fn();
    await render(
      <UndoToast
        visible={true}
        message="msg"
        onUndo={jest.fn()}
        onDismiss={onDismiss}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(6100);
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders nothing when not visible', async () => {
    const { toJSON } = await render(
      <UndoToast visible={false} message="msg" onUndo={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
