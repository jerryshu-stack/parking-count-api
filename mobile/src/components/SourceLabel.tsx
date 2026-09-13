import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { color, space } from '@/theme/tokens';
import { sourceLabel } from '@/utils/format';
import type { SpotSource } from '@/api/types';

/**
 * 政府資料 / 社群回報.
 *
 * A dot plus a word, not a filled pill -- source is context, not status, and a
 * badge on every row would compete with the availability number that actually
 * matters. Government is neutral; community carries the accent because it is the
 * thing the user contributed to see.
 */
export function SourceLabel({ source }: { source: SpotSource }) {
  const community = source === 'photo';
  return (
    <View style={styles.row}>
      <View
        style={[styles.dot, { backgroundColor: community ? color.accent : color.inkTertiary }]}
      />
      <Text variant="meta" tone={community ? 'accent' : 'tertiary'}>
        {sourceLabel(source)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginRight: space.xs + 1 },
});
