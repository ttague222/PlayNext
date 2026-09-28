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
});
