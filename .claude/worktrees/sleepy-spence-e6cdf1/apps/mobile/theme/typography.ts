import { FontFamily, FontSize } from '@lyfestack/shared';

export { FontFamily, FontSize };

export const TextStyles = {
  h1: { fontFamily: FontFamily.bold, fontSize: FontSize['4xl'], lineHeight: 44 },
  h2: { fontFamily: FontFamily.bold, fontSize: FontSize['3xl'], lineHeight: 36 },
  h3: { fontFamily: FontFamily.semiBold, fontSize: FontSize['2xl'], lineHeight: 30 },
  h4: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xl, lineHeight: 26 },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 24 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: FontSize.base, lineHeight: 24 },
  small: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  caption: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 16 },
  button: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, lineHeight: 24 },
} as const;
