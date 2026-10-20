import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';
import { DEFAULT_THEME } from '../tokens';
import { ThemeProvider, useTheme } from '../ThemeContext';

const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;
const harvest = vectors.palettes.find((p) => p.name === 'harvest').palette;

let lastTheme;
const Probe = () => {
  lastTheme = useTheme();
  return <Text>{String(lastTheme.accent.season)}</Text>;
};

beforeEach(() => {
  lastTheme = undefined;
});

describe('ThemeProvider / useTheme', () => {
  it('provides the seasonal theme for a safe palette', async () => {
    const { getByText } = await render(
      <ThemeProvider palette={spooky}>
        <Probe />
      </ThemeProvider>
    );
    getByText('#ff8a3d');
    expect(lastTheme.bg.flow[1]).toBe('#22103a');
    expect(lastTheme.accent.brand).toBe('#f857a6');
  });

  it('returns the default theme with no provider', async () => {
    await render(<Probe />);
    expect(lastTheme).toBe(DEFAULT_THEME);
  });

  it('falls back to the default theme for a null or unsafe palette', async () => {
    await render(
      <ThemeProvider palette={null}>
        <Probe />
      </ThemeProvider>
    );
    expect(lastTheme).toEqual(DEFAULT_THEME);

    await render(
      <ThemeProvider palette={harvest}>
        <Probe />
      </ThemeProvider>
    );
    expect(lastTheme).toEqual(DEFAULT_THEME);
  });

  it('keeps the same theme object while the palette is unchanged and updates when it changes', async () => {
    const seen = [];
    const Capture = () => {
      seen.push(useTheme());
      return null;
    };
    const { rerender } = await render(
      <ThemeProvider palette={spooky}>
        <Capture />
      </ThemeProvider>
    );
    await rerender(
      <ThemeProvider palette={spooky}>
        <Capture />
      </ThemeProvider>
    );
    expect(seen[seen.length - 1]).toBe(seen[0]);

    await rerender(
      <ThemeProvider palette={null}>
        <Capture />
      </ThemeProvider>
    );
    expect(seen[seen.length - 1]).toEqual(DEFAULT_THEME);
    expect(seen[seen.length - 1]).not.toBe(seen[0]);
  });
});
