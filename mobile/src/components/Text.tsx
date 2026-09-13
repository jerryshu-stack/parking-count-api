import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { color } from '@/theme/tokens';
import { text } from '@/theme/type';

type Variant = keyof typeof text;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse';

const tones: Record<Tone, string> = {
  primary: color.ink,
  secondary: color.inkSecondary,
  tertiary: color.inkTertiary,
  accent: color.accent,
  inverse: color.inkInverse,
};

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
}

/**
 * The only text component. Variant and tone are the two knobs -- arbitrary
 * fontSize/color props are deliberately not offered, so the scale stays a scale.
 */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  return <RNText {...rest} style={[text[variant] as TextStyle, { color: tones[tone] }, style]} />;
}
