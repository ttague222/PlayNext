import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_THEME, themeForPalette, type SeasonPalette, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(DEFAULT_THEME);

type ThemeProviderProps = {
  palette: SeasonPalette | null;
  children?: React.ReactNode;
};

export function ThemeProvider({ palette, children }: ThemeProviderProps) {
  const theme = useMemo(() => themeForPalette(palette), [palette]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active theme; DEFAULT_THEME outside a ThemeProvider. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
