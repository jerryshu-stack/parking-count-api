import { StyleSheet, View } from 'react-native';

import { color } from '@/theme/tokens';

/**
 * Marks a searched destination.
 *
 * After a search the map simply jumped somewhere and the only trace of what the
 * user asked for was the text left in the search field. This gives the point a
 * position on the map. It is deliberately not an availability marker -- it is a
 * ring, not a number, because it is a place, not a car park.
 */
export function DestinationPin() {
  return (
    <View style={styles.outer}>
      <View style={styles.inner} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: color.ink,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ink },
});
