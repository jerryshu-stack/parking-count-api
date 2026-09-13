/**
 * The whole visual system. Nothing outside this file should contain a raw hex
 * value, radius, or spacing number.
 */

export const color = {
  /** Warm off-white. The map is the bright surface; chrome sits slightly below it. */
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  /** Pressed state for rows and controls. */
  surfacePressed: '#F2F1EC',

  ink: '#14171A',
  inkSecondary: '#5C6166',
  inkTertiary: '#8A9096',
  inkInverse: '#FFFFFF',

  /** Very subtle neutral hairline -- warm, so it sits with the background. */
  hairline: '#E6E4DE',
  hairlineStrong: '#D8D5CC',

  /** One accent. Restrained urban green: primary actions and available spaces. */
  accent: '#17693F',
  accentPressed: '#125533',
  accentSoft: '#EAF2ED',

  /** Semantic availability. Green is the same family as the accent on purpose. */
  available: '#17693F',
  /** Only used when availability is genuinely low enough to matter. */
  low: '#A8641C',
  /** Only used at zero. */
  none: '#9A3B32',

  /** System blue, reserved for the user's own location. */
  location: '#007AFF',

  scrim: 'rgba(12,14,16,0.45)',
} as const;

/** 4pt grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Deliberately small radii -- large pills read as generic app chrome. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** One shadow, used only where something genuinely floats above the map. */
export const elevation = {
  floating: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  marker: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
} as const;
