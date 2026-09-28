import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import PressableScale from '../PressableScale';

describe('PressableScale', () => {
  it('renders children and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress} disabled>
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('chains onPressIn and onPressOut to callers', async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const { getByText } = await render(
      <PressableScale onPressIn={onPressIn} onPressOut={onPressOut} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    // fireEvent is async internally (it wraps the dispatch in `act()`); each
    // call must be awaited before firing the next one, otherwise the two
    // act() calls overlap and the pending one leaks into the next test.
    await fireEvent(getByText('Go'), 'pressIn');
    await fireEvent(getByText('Go'), 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('defaults accessibilityRole to button', async () => {
    const { getByRole } = await render(
      <PressableScale onPress={jest.fn()} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    expect(getByRole('button')).toBeTruthy();
  });
});
