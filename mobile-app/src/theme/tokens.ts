/**
 * Theme tokens (design spec 6.1, 6.2).
 *
 * DEFAULT_THEME is today's palette. A season may override only the roles
 * themeForPalette() sets (bg.*, accent.season, onAccent.season, overlay.scrim);
 * every other role is locked. `accent.season` is null in the default theme,
 * meaning "the component keeps its current literal", so the default renders
 * exactly as before.
 */

import { paletteViolations, type SeasonPalette } from './palette';

export type { SeasonPalette } from './palette';

type Gradient = [string, string, string];

export type Theme = {
  /** home: Play tab. flow: quiz + results. side: Library, Profile and the screens they open. */
  bg: { home: Gradient; flow: Gradient; side: Gradient; decor: string | null };
  accent: { season: string | null; brand: string; brandEnd: string };
  onAccent: { season: string | null; brand: string; brandSmall: string };
  glow: { brand: string };
  text: { primary: string; secondary: string; muted: string };
  surface: { card: string; chip: string };
  semantic: { success: string; error: string; warning: string; rating: string };
  mood: { windDown: string; casual: string; focused: string; intense: string };
  overlay: { scrim: string };
  share: { gradient: Gradient };
  /** Tab bar and the stack's backing color behind screens. */
  nav: { bar: string; border: string; active: string; inactive: string; screen: string };
};

export const DEFAULT_THEME: Theme = {
  bg: {
    home: ['#0a0a1a', '#1a1a2e', '#16213e'],
    flow: ['#0f0c29', '#302b63', '#24243e'],
    side: ['#1a1a2e', '#16213e', '#0f3460'],
    decor: null,
  },
  accent: { season: null, brand: '#f857a6', brandEnd: '#ff5858' },
  onAccent: { season: null, brand: '#ffffff', brandSmall: '#0a0a1a' },
  glow: { brand: '#f857a6' },
  // muted is #9a9a9a rather than today's #909090/#808080: it is the gray that
  // clears 4.5:1 on the flow gradient's middle stop #302b63 (spec 6.4).
  text: { primary: '#ffffff', secondary: '#a0a0a0', muted: '#9a9a9a' },
  surface: { card: 'rgba(255, 255, 255, 0.06)', chip: 'rgba(255, 255, 255, 0.08)' },
  semantic: { success: '#4ade80', error: '#ef4444', warning: '#f59e0b', rating: '#fbbf24' },
  mood: { windDown: '#7c3aed', casual: '#06b6d4', focused: '#f59e0b', intense: '#ef4444' },
  overlay: { scrim: '#0f0c29' },
  share: { gradient: ['#0f0c29', '#1a1a2e', '#16213e'] },
  nav: { bar: '#1a1a2e', border: '#2a2a4e', active: '#e94560', inactive: '#808080', screen: '#1a1a2e' },
};

/**
 * Default theme with a season's overrides. A missing or malformed palette, or
 * one that fails the guardrail, yields DEFAULT_THEME (the season card still
 * shows; only the look falls back).
 */
export function themeForPalette(palette: SeasonPalette | null | undefined): Theme {
  if (!palette || paletteViolations(palette).length > 0) return DEFAULT_THEME;
  const stops = palette.bg_gradient;
  return {
    ...DEFAULT_THEME,
    bg: {
      home: [stops[0], stops[1], stops[2]],
      flow: [stops[0], stops[1], stops[2]],
      side: [stops[0], stops[1], stops[2]],
      decor: palette.bg_decor,
    },
    accent: { ...DEFAULT_THEME.accent, season: palette.accent_season },
    onAccent: { ...DEFAULT_THEME.onAccent, season: palette.on_accent_season },
    overlay: { scrim: stops[0] },
    // The bar takes the gradient's bottom stop so it reads as one surface with
    // the screen above it. Labels use brand pink (active) and text.secondary
    // (inactive); the guardrail checks text.secondary on that stop.
    nav: {
      bar: stops[2],
      border: stops[1],
      active: DEFAULT_THEME.accent.brand,
      inactive: DEFAULT_THEME.text.secondary,
      screen: stops[0],
    },
  };
}
