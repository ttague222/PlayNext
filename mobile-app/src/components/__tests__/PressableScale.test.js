import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import PressableScale from '../PressableScale';

// RNTL's fireEvent(hostNode, 'pressIn'/'pressOut') is gated by the real
// Pressable's onStartShouldSetResponder, which reports "not enabled" once
// `disabled` is true. That correctly models a NEW touch being rejected, but
// it also blocks simulating an in-flight touch (native responder already
// granted) whose release arrives after `disabled` flips mid-press — exactly
// the scenario Nit 2 fixes. To reach our onPressIn/onPressOut handlers
// directly (as the native responder would for an already-granted touch),
// walk the underlying fiber tree to the <Pressable> element's memoized
// props and invoke the handler ourselves, bypassing RNTL's disabled gate.
function findPressableFiber(hostInstance) {
  let fiber = hostInstance.unstable_fiber;
  while (fiber) {
    if (fiber.memoizedProps && typeof fiber.memoizedProps.onPressOut === 'function') {
      return fiber;
    }
    fiber = fiber.return;
  }
  throw new Error('Could not find the underlying Pressable fiber');
}

describe('PressableScale', () => {
  it('renders children and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    await fireEvent.press(getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <PressableScale onPress={onPress} disabled>
        <Text>Go</Text>
      </PressableScale>
    );
    await fireEvent.press(getByText('Go'));
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

  it('shows a darkening overlay while pressed when darkenOnPress is set (P0.6)', async () => {
    const { getByText, queryByTestId } = await render(
      <PressableScale darkenOnPress accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    expect(queryByTestId('pressed-overlay')).toBeNull();
    await fireEvent(getByText('Go'), 'pressIn');
    expect(queryByTestId('pressed-overlay')).toBeTruthy();
    await fireEvent(getByText('Go'), 'pressOut');
    expect(queryByTestId('pressed-overlay')).toBeNull();
  });

  it('never shows the overlay without darkenOnPress', async () => {
    const { getByText, queryByTestId } = await render(
      <PressableScale accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    await fireEvent(getByText('Go'), 'pressIn');
    expect(queryByTestId('pressed-overlay')).toBeNull();
    await fireEvent(getByText('Go'), 'pressOut');
    expect(queryByTestId('pressed-overlay')).toBeNull();
  });

  it('clears stranded press state when disabled mid-press', async () => {
    const { getByRole, queryByTestId, rerender } = await render(
      <PressableScale darkenOnPress accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    const pressableFiber = findPressableFiber(getByRole('button'));
    await act(async () => {
      pressableFiber.memoizedProps.onPressIn({});
    });
    expect(queryByTestId('pressed-overlay')).toBeTruthy();

    // Disable mid-press (e.g. the action becomes unavailable while a
    // finger is still down) — the in-flight touch's pressOut must still
    // clear the stranded pressed state / scale, but must not invoke the
    // caller's onPressOut since the control is now disabled.
    const onPressOut = jest.fn();
    await rerender(
      <PressableScale darkenOnPress disabled onPressOut={onPressOut} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    await act(async () => {
      pressableFiber.memoizedProps.onPressOut({});
    });
    expect(queryByTestId('pressed-overlay')).toBeNull();
    expect(onPressOut).not.toHaveBeenCalled();
  });
});
