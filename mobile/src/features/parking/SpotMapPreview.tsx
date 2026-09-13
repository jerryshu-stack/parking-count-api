import { Pressable, StyleSheet, View } from 'react-native';

import { MapCanvas } from '@/features/map/MapCanvas';
import { Text } from '@/components/Text';
import { color, radius, space } from '@/theme/tokens';
import type { NearbySpot } from '@/api/types';

/**
 * A small, non-interactive locator. It answers "where is this, roughly" without
 * pretending to be a second map -- panning and selection belong to the map tab,
 * and tapping here goes straight to directions.
 */
export function SpotMapPreview({ spot, onPress }: { spot: NearbySpot; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.frame} accessibilityRole="button">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <MapCanvas
          region={{
            latitude: spot.latitude,
            longitude: spot.longitude,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          }}
          spots={[spot]}
          selectedKey={null}
          showsUserLocation={false}
          onRegionChange={() => {}}
          onSelect={() => {}}
          onPressMap={() => {}}
        />
      </View>
      <View style={styles.badge}>
        <Text variant="caption" tone="secondary">
          點擊開啟導航
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 170,
    marginHorizontal: space.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  badge: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
