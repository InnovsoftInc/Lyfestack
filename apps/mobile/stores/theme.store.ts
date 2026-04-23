import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lyfestack_theme_dark';

interface ThemeStore {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  const systemDark = Appearance.getColorScheme() === 'dark';

  AsyncStorage.getItem(STORAGE_KEY)
    .then((saved) => {
      if (saved !== null) set({ isDark: saved === '1' });
    })
    .catch(() => {});

  return {
    isDark: systemDark,
    toggle: () => {
      const next = !get().isDark;
      set({ isDark: next });
      AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {});
    },
    setDark: (dark) => {
      set({ isDark: dark });
      AsyncStorage.setItem(STORAGE_KEY, dark ? '1' : '0').catch(() => {});
    },
  };
});
