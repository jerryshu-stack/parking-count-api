import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { color, radius, space } from '@/theme/tokens';

interface Props {
  count: number;
  onPress: () => void;
}

/**
 * Shown once, above the list, only when community reports actually exist nearby.
 *
 * The government product stays fully usable, so this is an invitation rather than
 * a paywall: no lock icons scattered over the map, no blurred rows, no overlay.
 * It states what is there and what opens it, and gets out of the way.
 */
export function LockedCommunityNotice({ count, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text variant="label">附近有 {count} 筆社群即時回報</Text>
        <Text variant="meta" tone="secondary" style={styles.sub}>
          分享一張停車照片，即可查看其他駕駛回報的車位。
        </Text>
      </View>
      <Text variant="label" tone="accent">
        拍照回報
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.md,
    backgroundColor: color.accentSoft,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, paddingRight: space.md },
  sub: { marginTop: 3 },
});
