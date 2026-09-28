import React from 'react';
import { Text } from 'react-native';
import { AccessibilityInfo } from 'react-native';
import { render, act } from '@testing-library/react-native';
import useReducedMotion from '../useReducedMotion';

// Small host component so we can observe the hook's return value through
// rendered text, and unmount it to exercise subscription cleanup.
const Probe = () => {
  const reducedMotion = useReducedMotion();
  return <Text>{reducedMotion ? 'on' : 'off'}</Text>;
};

describe('useReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to false before the initial read resolves', async () => {
    let resolveEnabled;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise((resolve) => {
        resolveEnabled = resolve;
      })
    );
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() });

    const { getByText } = await render(<Probe />);
    expect(getByText('off')).toBeTruthy();

    await act(async () => {
      resolveEnabled(true);
    });
  });

  it('resolves to true when the OS reports reduce motion enabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() });

    const { getByText } = await render(<Probe />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('on')).toBeTruthy();
  });

  it('updates when the reduceMotionChanged event fires', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    let changeHandler;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
      changeHandler = handler;
      return { remove: jest.fn() };
    });

    const { getByText } = await render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByText('off')).toBeTruthy();

    await act(async () => {
      changeHandler(true);
    });
    expect(getByText('on')).toBeTruthy();
  });

  it('cleans up its subscription on unmount without throwing', async () => {
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove });

    const { unmount } = await render(<Probe />);
    await act(async () => {
      expect(() => unmount()).not.toThrow();
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
