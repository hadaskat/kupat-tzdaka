import { MD3LightTheme } from 'react-native-paper';

/**
 * Matches the visual language of the sibling app: a cool blue-grey page,
 * white cards with a hairline border, an indigo accent used sparingly, and
 * figures coloured by meaning rather than decoration.
 */
export const palette = {
  // Deep teal: distinct enough from the money-in green that a coloured figure
  // is never mistaken for a status.
  accent: '#0F766E',
  accentDark: '#115E59',
  accentSoft: '#E6F4F1',

  moneyIn: '#16A34A',
  moneyOut: '#DC2626',
  neutralFigure: '#1E293B',

  ink: '#1E293B',
  inkMuted: '#64748B',
  inkFaint: '#94A3B8',

  page: '#F1F5F9',
  surface: '#FFFFFF',
  line: '#E2E8F0',
};

export const theme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.accent,
    onPrimary: '#FFFFFF',
    primaryContainer: palette.accentSoft,
    onPrimaryContainer: palette.accentDark,

    secondary: palette.inkMuted,
    onSecondary: '#FFFFFF',
    secondaryContainer: palette.page,
    onSecondaryContainer: palette.ink,

    error: palette.moneyOut,
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',

    background: palette.page,
    onBackground: palette.ink,
    surface: palette.surface,
    onSurface: palette.ink,
    surfaceVariant: palette.page,
    onSurfaceVariant: palette.inkMuted,

    outline: palette.line,
    outlineVariant: palette.line,

    elevation: {
      level0: 'transparent',
      level1: palette.surface,
      level2: palette.surface,
      level3: palette.surface,
      level4: palette.surface,
      level5: palette.surface,
    },
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/** Content stops widening past this so lines never stretch across a monitor. */
export const CONTENT_MAX_WIDTH = 1180;

/** Below this the multi-column layouts collapse to a single column. */
export const WIDE_BREAKPOINT = 900;

export const card = {
  backgroundColor: palette.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: palette.line,
};
