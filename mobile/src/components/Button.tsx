import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Text } from './Text';
import { color, radius, space } from '@/theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** Two button styles exist. There is no third. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && !inactive && (primary ? styles.primaryPressed : styles.secondaryPressed),
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? color.inkInverse : color.ink} />
      ) : (
        <Text variant="button" tone={primary ? 'inverse' : 'primary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  primary: { backgroundColor: color.primary },
  primaryPressed: { backgroundColor: color.primaryPressed },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.hairlineStrong },
  secondaryPressed: { backgroundColor: color.surfacePressed },
  inactive: { opacity: 0.4 },
});
