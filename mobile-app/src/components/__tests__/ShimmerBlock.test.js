import React from 'react';
import { render } from '@testing-library/react-native';
import ShimmerBlock from '../ShimmerBlock';

describe('ShimmerBlock', () => {
  it('renders without crashing with a style', async () => {
    const { toJSON } = await render(
      <ShimmerBlock style={{ width: 100, height: 60, borderRadius: 14 }} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('contains no ActivityIndicator', async () => {
    const { toJSON } = await render(<ShimmerBlock style={{ width: 100, height: 60 }} />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('ActivityIndicator');
  });

  it('unmounts cleanly (stops its animation loop)', async () => {
    const { unmount } = await render(<ShimmerBlock style={{ width: 100, height: 60 }} />);
    expect(() => unmount()).not.toThrow();
  });
});
