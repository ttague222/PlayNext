import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';
import { DEFAULT_THEME, themeForPalette } from '../tokens';
import { alpha, contrastRatio, deltaE2000, paletteViolations } from '../palette';

// Cross-language contract with api-service/src/services/palette_check.py:
// vectors are stored to 2 decimals, so allow half a unit in the last place plus slack.
const TOLERANCE = 0.05;

const paletteNamed = (name) => vectors.palettes.find((p) => p.name === name).palette;

describe('shared vectors', () => {
  it.each(vectors.contrast)('contrastRatio(%s, %s) is %s', (a, b, expected) => {
    expect(Math.abs(contrastRatio(a, b) - expected)).toBeLessThan(TOLERANCE);
    expect(Math.abs(contrastRatio(b, a) - expected)).toBeLessThan(TOLERANCE);
  });

  it.each(vectors.delta_e)('deltaE2000(%s, %s) is %s', (a, b, expected) => {
    expect(Math.abs(deltaE2000(a, b) - expected)).toBeLessThan(TOLERANCE);
  });

  it.each(vectors.palettes.map((p) => [p.name, p.palette, p.safe]))(
    'paletteViolations agrees with the vectors for %s',
    (_name, palette, safe) => {
      expect(paletteViolations(palette).length === 0).toBe(safe);
    }
  );
});

describe('paletteViolations', () => {
  it('names the rule, colors and measured value', () => {
    const harvest = paletteViolations(paletteNamed('harvest'));
    // Harvest fails only on perceptual distance: Focused and Warning share #f59e0b, Rating is #fbbf24.
    expect(harvest).toHaveLength(3);
    expect(harvest.every((v) => v.startsWith('delta E2000: accent_season #f0a33a'))).toBe(true);
    expect(harvest[0]).toBe('delta E2000: accent_season #f0a33a is 3.1 from mood.focused #f59e0b (need >= 12)');

    const whiteText = paletteViolations(paletteNamed('spooky-white-text-on-accent'));
    expect(whiteText).toHaveLength(1);
    expect(whiteText[0]).toMatch(/on_accent_season #ffffff on accent_season #ff8a3d/);
  });

  it('flags a bg stop that is too light for white text', () => {
    const light = { ...paletteNamed('spooky'), bg_gradient: ['#0d0716', '#22103a', '#c0c0c0'] };
    const violations = paletteViolations(light);
    expect(violations.some((v) => /#ffffff on bg stop #c0c0c0/.test(v))).toBe(true);
  });

  it('flags secondary text that fails on the middle stop', () => {
    const light = { ...paletteNamed('spooky'), bg_gradient: ['#0d0716', '#707070', '#0d0716'] };
    expect(paletteViolations(light).some((v) => /text\.secondary.*middle stop #707070/.test(v))).toBe(true);
  });

  it('flags secondary text that fails on the bottom stop (the tab bar)', () => {
    const light = { ...paletteNamed('spooky'), bg_gradient: ['#0d0716', '#22103a', '#4a4a6a'] };
    expect(paletteViolations(light).some((v) => /text\.secondary.*bottom stop #4a4a6a/.test(v))).toBe(true);
  });

  it('flags brand pink that disappears against the lightest stop', () => {
    const pinkish = { ...paletteNamed('spooky'), bg_gradient: ['#0d0716', '#22103a', '#f857a6'] };
    expect(paletteViolations(pinkish).some((v) => /brand #f857a6 on lightest stop #f857a6/.test(v))).toBe(true);
  });

  it('accepts upper-case hex', () => {
    const upper = {
      bg_gradient: ['#0D0716', '#22103A', '#2E1546'],
      bg_decor: '#FF8A3D',
      accent_season: '#FF8A3D',
      on_accent_season: '#1A0B00',
    };
    expect(paletteViolations(upper)).toEqual([]);
  });

  it('reports malformed palettes as violations instead of throwing', () => {
    const spooky = paletteNamed('spooky');
    const malformed = [
      null,
      undefined,
      {},
      'nope',
      { ...spooky, bg_gradient: undefined },
      { ...spooky, bg_gradient: ['#000000', '#111111'] },
      { ...spooky, bg_gradient: 'abc' },
      { ...spooky, bg_gradient: ['#000000', '#111111', 'blue'] },
      { ...spooky, bg_gradient: ['#000', '#111', '#222'] },
      { ...spooky, accent_season: '#ff8a3' },
      { ...spooky, accent_season: 12 },
      { ...spooky, on_accent_season: undefined },
    ];
    for (const palette of malformed) {
      expect(paletteViolations(palette).length).toBeGreaterThan(0);
    }
    expect(paletteViolations({ ...spooky, bg_gradient: ['#000000', '#111111'] })[0]).toMatch(/3 stops/);
    expect(paletteViolations({ ...spooky, accent_season: 'red' })[0]).toMatch(/malformed palette/);
  });
});

describe('alpha', () => {
  it('turns a hex color into rgba', () => {
    expect(alpha('#f857a6', 0.2)).toBe('rgba(248,87,166,0.2)');
    expect(alpha('#000000', 1)).toBe('rgba(0,0,0,1)');
    expect(alpha('#FFFFFF', 0)).toBe('rgba(255,255,255,0)');
  });
});

describe('themeForPalette', () => {
  it('returns the default theme for null', () => {
    expect(themeForPalette(null)).toEqual(DEFAULT_THEME);
  });

  it('returns the default theme for a palette that fails the guardrail', () => {
    expect(themeForPalette(paletteNamed('harvest'))).toEqual(DEFAULT_THEME);
    expect(themeForPalette(paletteNamed('summer'))).toEqual(DEFAULT_THEME);
  });

  it('returns the default theme for a malformed palette', () => {
    expect(themeForPalette({})).toEqual(DEFAULT_THEME);
    expect(themeForPalette(undefined)).toEqual(DEFAULT_THEME);
  });

  it('applies a safe palette and keeps the locked roles', () => {
    const spooky = paletteNamed('spooky');
    const theme = themeForPalette(spooky);
    expect(theme.bg.home).toEqual(spooky.bg_gradient);
    expect(theme.bg.flow).toEqual(spooky.bg_gradient);
    expect(theme.bg.flow[1]).toBe('#22103a');
    expect(theme.bg.decor).toBe('#ff8a3d');
    expect(theme.accent.season).toBe('#ff8a3d');
    expect(theme.onAccent.season).toBe('#1a0b00');
    expect(theme.overlay.scrim).toBe('#0d0716');

    expect(theme.accent.brand).toBe('#f857a6');
    expect(theme.accent.brandEnd).toBe('#ff5858');
    expect(theme.onAccent.brand).toBe(DEFAULT_THEME.onAccent.brand);
    expect(theme.text).toEqual(DEFAULT_THEME.text);
    expect(theme.mood).toEqual(DEFAULT_THEME.mood);
    expect(theme.semantic).toEqual(DEFAULT_THEME.semantic);
    expect(theme.share).toEqual(DEFAULT_THEME.share);

    // Tab bar: one surface with the screen's bottom stop, brand pink active,
    // text.secondary inactive (the guardrail checks it on that stop).
    expect(theme.nav).toEqual({
      bar: '#2e1546',
      border: '#22103a',
      active: '#f857a6',
      inactive: '#a0a0a0',
      screen: '#0d0716',
    });
  });

  it('does not alias the palette gradient array or mutate the default theme', () => {
    const spooky = paletteNamed('spooky');
    const before = JSON.stringify(DEFAULT_THEME);
    const theme = themeForPalette(spooky);
    expect(theme.bg.home).not.toBe(spooky.bg_gradient);
    expect(theme.bg.home).not.toBe(theme.bg.flow);
    expect(JSON.stringify(DEFAULT_THEME)).toBe(before);
  });
});

describe('DEFAULT_THEME', () => {
  it("keeps today's tab bar colors", () => {
    expect(DEFAULT_THEME.nav).toEqual({
      bar: '#1a1a2e',
      border: '#2a2a4e',
      active: '#e94560',
      inactive: '#808080',
      screen: '#1a1a2e',
    });
  });

  it('passes the guardrail text rules on its own flow gradient, including muted text', () => {
    const [, mid] = DEFAULT_THEME.bg.flow;
    expect(contrastRatio(DEFAULT_THEME.text.primary, mid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DEFAULT_THEME.text.secondary, mid)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DEFAULT_THEME.text.muted, mid)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the locked reference colors the guardrail checks against', () => {
    expect(DEFAULT_THEME.mood).toEqual({
      windDown: '#7c3aed',
      casual: '#06b6d4',
      focused: '#f59e0b',
      intense: '#ef4444',
    });
    expect(DEFAULT_THEME.semantic).toEqual({
      success: '#4ade80',
      error: '#ef4444',
      warning: '#f59e0b',
      rating: '#fbbf24',
    });
  });
});
