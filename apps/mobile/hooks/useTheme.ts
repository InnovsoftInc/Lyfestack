import { useThemeStore } from '../stores/theme.store';
import { DarkTheme, LightTheme } from '../theme/colors';
import type { Theme } from '../theme/colors';

export function useTheme(): Theme {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? DarkTheme : LightTheme;
}
