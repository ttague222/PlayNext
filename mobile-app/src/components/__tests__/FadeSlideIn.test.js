import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import FadeSlideIn from '../FadeSlideIn';

describe('FadeSlideIn', () => {
  it('renders children when enabled', async () => {
    const { getByText } = await render(
      <FadeSlideIn>
        <Text>Card content</Text>
      </FadeSlideIn>
    );
    expect(getByText('Card content')).toBeTruthy();
  });

  it('renders children statically when enabled={false}', async () => {
    const { getByText } = await render(
      <FadeSlideIn enabled={false}>
        <Text>Card content</Text>
      </FadeSlideIn>
    );
    expect(getByText('Card content')).toBeTruthy();
  });

  it('does not blow up with a delay prop set', async () => {
    const { getByText } = await render(
      <FadeSlideIn delay={240}>
        <Text>Delayed content</Text>
      </FadeSlideIn>
    );
    expect(getByText('Delayed content')).toBeTruthy();
  });

  it('applies a passed style to the wrapper', async () => {
    const { toJSON } = await render(
      <FadeSlideIn style={{ marginTop: 12 }}>
        <Text>Styled</Text>
      </FadeSlideIn>
    );
    const json = toJSON();
    // Outer Animated.View is the root node — style array should carry the
    // caller's style alongside the animated opacity/transform.
    expect(JSON.stringify(json.props.style)).toContain('12');
  });
});
