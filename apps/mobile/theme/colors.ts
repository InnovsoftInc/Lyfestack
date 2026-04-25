import { Colors } from '@lyfestack/shared';

export const LightTheme = {
  background: Colors.white,
  surface: Colors.gray50,
  border: Colors.gray200,
  text: {
    primary: Colors.gray900,
    secondary: Colors.gray500,
    inverse: Colors.white,
  },
  accent: Colors.accent,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
};

export const DarkTheme = {
  background: Colors.black,
  surface: Colors.gray900,
  border: Colors.gray800,
  text: {
    primary: Colors.white,
    secondary: Colors.gray400,
    inverse: Colors.black,
  },
  accent: Colors.accent,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
};

export interface Theme {
  background: string;
  surface: string;
  border: string;
  text: { primary: string; secondary: string; inverse: string };
  accent: string;
  success: string;
  warning: string;
  error: string;
}
