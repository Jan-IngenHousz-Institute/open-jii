// JII Design System - Typography Tokens
import { TextStyle } from 'react-native';

// Font families
export const fontFamily = {
  headline: 'Poppins-Bold',
  body: 'Overpass-Regular',
  bodyMedium: 'Overpass-Medium',
  subheader: 'Overpass-Bold',
  subheaderExtraBold: 'Overpass-ExtraBold',
  subheaderBlack: 'Overpass-Black',
};

// Font sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

// Line heights
export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

// Font weights - using valid React Native values
export const fontWeight = {
  regular: 'normal' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: 'bold' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// Typography styles
export const typography: Record<string, TextStyle> = {
  // Headlines (Poppins Bold)
  h1: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h2: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h3: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h4: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h5: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h6: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  
  // Lead text and quotes (Poppins Bold)
  lead: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.relaxed,
    fontWeight: fontWeight.bold,
  },
  quote: {
    fontFamily: fontFamily.headline,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
    fontWeight: fontWeight.bold,
    fontStyle: 'italic',
  },
  
  // Body text (Overpass)
  bodyLarge: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.medium,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  
  // Subheaders (Overpass Bold/ExtraBold/Black)
  subheaderLarge: {
    fontFamily: fontFamily.subheader,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.normal,
    fontWeight: fontWeight.bold,
  },
  subheader: {
    fontFamily: fontFamily.subheader,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.bold,
  },
  subheaderExtraBold: {
    fontFamily: fontFamily.subheaderExtraBold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.extrabold,
  },
  subheaderBlack: {
    fontFamily: fontFamily.subheaderBlack,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.black,
  },
  
  // Utility text styles
  button: {
    fontFamily: fontFamily.subheader,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },
  overline: {
    fontFamily: fontFamily.subheader,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
};