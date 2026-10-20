import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  activeSeason,
  getCachedSeasonalContentSync,
  loadSeasonalContent,
  type Palette,
  type SeasonalContent,
} from '../services/seasonalService';
import { ThemeProvider } from './ThemeContext';
import type { SeasonPalette } from './tokens';

/**
 * Applies the active season's palette app-wide (design spec 5.1, 6.1).
 *
 * The first render reads the in-memory/bundled content synchronously so a cold
 * start paints the right look with no default flash. Content is reloaded on
 * mount and whenever the app returns to the foreground (the date may have
 * rolled into a new season); loadSeasonalContent() handles its own 6-hour
 * refresh. An unsafe or missing palette is handled by ThemeProvider, which
 * falls back to the default theme without affecting the season cards.
 */

const paletteFor = (content: SeasonalContent): Palette | null => activeSeason(content)?.palette ?? null;

const samePalette = (a: Palette | null, b: Palette | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.bg_decor === b.bg_decor &&
    a.accent_season === b.accent_season &&
    a.on_accent_season === b.on_accent_season &&
    a.bg_gradient.length === b.bg_gradient.length &&
    a.bg_gradient.every((stop, i) => stop === b.bg_gradient[i]));

export function SeasonalThemeRoot({ children }: { children?: React.ReactNode }) {
  const [palette, setPalette] = useState<Palette | null>(() => paletteFor(getCachedSeasonalContentSync()));

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const next = paletteFor(await loadSeasonalContent());
        // A reload usually returns freshly parsed content; keep the previous
        // palette reference when nothing changed so the theme stays stable.
        if (!cancelled) setPalette((prev) => (samePalette(prev, next) ? prev : next));
      } catch {
        // loadSeasonalContent never throws; keep the current look regardless.
      }
    };

    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // ThemeProvider validates the palette (paletteViolations) before using it.
  return <ThemeProvider palette={palette as SeasonPalette | null}>{children}</ThemeProvider>;
}
