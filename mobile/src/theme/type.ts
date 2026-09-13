import { Platform, TextStyle } from 'react-native';

/**
 * System typography only. On iOS the system stack resolves Latin to SF Pro and
 * Traditional Chinese to PingFang TC automatically, which is exactly what we want --
 * a bundled Latin display face would render Chinese in a mismatched fallback.
 *
 * Chinese needs more leading than Latin at the same size, so line heights here are
 * generous by Latin standards on purpose.
 */

const numeric: TextStyle = Platform.select({
  ios: { fontVariant: ['tabular-nums'] },
  default: { fontVariant: ['tabular-nums'] },
})!;

export const text = {
  /** The availability count on a detail screen. The largest thing on any screen. */
  display: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -1.4,
    ...numeric,
  } as TextStyle,

  /** Screen titles: 社群, 我的. */
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  } as TextStyle,

  /** Parking name on a detail screen; section heads. */
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,

  /** Primary row text. */
  rowTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.1,
  } as TextStyle,

  body: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  } as TextStyle,

  /** Metadata under a row: distance, freshness, source. */
  meta: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  } as TextStyle,

  /** Compact uppercase-ish labels. Chinese does not have case, so weight carries it. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  } as TextStyle,

  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  } as TextStyle,

  /** Numbers inside map markers. */
  marker: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    ...numeric,
  } as TextStyle,

  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
} as const;
