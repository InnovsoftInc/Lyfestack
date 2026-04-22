import { useColorScheme } from 'react-native';
import { DarkTheme, LightTheme } from '../theme/colors';
import type { Theme } from '../theme/colors';

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkTheme : LightTheme;
}
