import { StyleSheet, View } from 'react-native';

import { ROW_TEXT_INSET } from './ParkingRow';
import { color, radius, space } from '@/theme/tokens';

/**
 * Loading state shaped like the rows that are coming, not a spinner on an empty
 * panel. The list keeps its geometry while data lands, so arriving results slot
 * into place instead of the whole sheet jumping.
 */
export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.count} />
      </View>
      <View style={styles.body}>
        <View style={styles.title} />
        <View style={styles.meta} />
      </View>
    </View>
  );
}

export function RowSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </View>
  );
}

const bone = { backgroundColor: color.surfacePressed, borderRadius: radius.sm } as const;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: space.md + 2, paddingHorizontal: space.lg },
  rail: { width: ROW_TEXT_INSET - space.lg - space.md, alignItems: 'flex-end' },
  count: { ...bone, width: 34, height: 22 },
  body: { flex: 1, marginLeft: space.md },
  title: { ...bone, width: '62%', height: 15 },
  meta: { ...bone, width: '42%', height: 11, marginTop: 9 },
});
