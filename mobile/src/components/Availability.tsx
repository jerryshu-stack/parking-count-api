import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { color, space } from '@/theme/tokens';

/** Availability colour is semantic, not decorative: it only encodes how full it is. */
export function availabilityColor(count: number): string {
  if (count === 0) return color.none;
  if (count <= 3) return color.low;
  return color.available;
}

/**
 * The count as it appears in a list row: number and unit on one baseline, so the
 * digit is what the eye lands on.
 */
export function AvailabilityInline({ count }: { count: number }) {
  return (
    <View style={styles.row}>
      <Text variant="rowTitle" style={[styles.count, { color: availabilityColor(count) }]}>
        {count}
      </Text>
      <Text variant="meta" tone="secondary" style={styles.unit}>
        {count === 0 ? '已滿' : '個空位'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  count: { fontVariant: ['tabular-nums'] },
  unit: { marginLeft: space.tight },
});
