import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

// C2: useReducedMotion now reads AccessibilityInfo.isReduceMotionEnabled()
// and registers its 'reduceMotionChanged' listener exactly ONCE, at module
// import — a shared cache + Set of React setState listeners, instead of
// once per hook instance.
//
// jest.resetModules() between tests doesn't work here the way it did for
// the old per-instance hook: resetting the module registry also clears
// React's own module cache, so a freshly-required hook module ends up bound
// to a different React instance than the one rendering these tests, and
// hook calls fail with "Cannot read properties of null (reading
// 'useState')" (two React copies, one render tree).
//
// Instead: spy on the real (preset-mocked) AccessibilityInfo BEFORE the
// hook module is first required, capturing the single resolver + change
// handler its one-time module-level read/subscribe creates, then require
// the hook with plain CommonJS `require` (not an ES import) so it executes
// at this exact point — after the spies are wired up, not hoisted above
// them. Tests run in order against this one shared module instance, same
// as the real app.
let mockResolveReduceMotion;
let mockReduceMotionChangedHandler;

jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
  () =>
    new Promise((resolve) => {
      mockResolveReduceMotion = resolve;
    })
);
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
  mockReduceMotionChangedHandler = handler;
  return { remove: jest.fn() };
});

// eslint-disable-next-line global-require
const useReducedMotion = require('../useReducedMotion').default;

// Small host component so we can observe the hook's return value through
// rendered text, and unmount it to exercise subscription cleanup.
const Probe = () => {
  const reducedMotion = useReducedMotion();
  return <Text>{reducedMotion ? 'on' : 'off'}</Text>;
};

describe('useReducedMotion (C2 — module-level cache)', () => {
  it('defaults to false before the initial read resolves, then picks up the resolved value', async () => {
    const { getByText } = await render(<Probe />);
    expect(getByText('off')).toBeTruthy();

    await act(async () => {
      mockResolveReduceMotion(true);
      await Promise.resolve();
    });

    expect(getByText('on')).toBeTruthy();
  });

  it('shares the already-resolved cache with a newly-mounted instance (no extra OS read)', async () => {
    // From the previous test: cached is already true.
    const { getByText } = await render(<Probe />);
    expect(getByText('on')).toBeTruthy();

    // Only the one module-level read ever happened, not one per instance.
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
  });

  it('updates every mounted instance when reduceMotionChanged fires', async () => {
    const { getAllByText, getByText } = await render(
      <>
        <Probe />
        <Probe />
      </>
    );
    // Cached is still true from the earlier tests.
    expect(getAllByText('on').length).toBe(2);

    await act(async () => {
      mockReduceMotionChangedHandler(false);
    });

    expect(getAllByText('off').length).toBe(2);
    expect(() => getByText('on')).toThrow();
  });

  it('cleans up its listener subscription on unmount without throwing or leaking updates', async () => {
    const { unmount } = await render(<Probe />);

    await act(async () => {
      expect(() => unmount()).not.toThrow();
    });

    // The unmounted instance's setState was removed from the shared
    // listener Set — firing another change event must not warn/error about
    // updating an unmounted component.
    await act(async () => {
      expect(() => mockReduceMotionChangedHandler(true)).not.toThrow();
    });
  });
});
