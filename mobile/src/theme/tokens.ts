/**
 * The whole visual system. Nothing outside this file should contain a raw hex
 * value, radius, or spacing number.
 */

export const color = {
  /**
   * Warm off-white, but with the yellow pulled back: the previous ground was warm
   * enough that the green sitting on it read as an eco-brand pairing.
   */
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfacePressed: '#F1F1EC',

  /**
   * The greys carry a slight green bias rather than being neutral. A pure mid-grey
   * on a warm ground reads as unconsidered; biasing it toward the accent makes the
   * whole palette look chosen.
   */
  ink: '#16191B',
  inkSecondary: '#5A625E',
  inkTertiary: '#8A918C',
  inkInverse: '#FFFFFF',

  hairline: '#E5E4DD',
  hairlineStrong: '#D6D5CC',

  /**
   * Deep pine rather than a pure green. Saturated grass-green is the single thing
   * that made this palette look cheap, and it is worst at large areas -- which is
   * why the primary button below is ink, not this.
   */
  accent: '#12573A',
  accentSoft: '#EDF2EE',

  /**
   * Primary actions are near-black, not green.
   *
   * A full-width saturated green button is decoration: it colours a surface that
   * carries no meaning, and it competes with the counts, which are the only thing
   * on screen where green means something. Keeping buttons neutral is what lets a
   * green number read as information rather than as house style.
   */
  primary: '#16191B',
  primaryPressed: '#2C3033',

  /** Semantic availability. Same family as the accent, deliberately. */
  available: '#12573A',
  /** Only when availability is genuinely low enough to matter. */
  low: '#8E5A15',
  /** Only at zero. */
  none: '#8C3228',

  /** System blue, reserved for the user's own location. */
  location: '#007AFF',

  scrim: 'rgba(12,14,16,0.45)',
} as const;;

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
