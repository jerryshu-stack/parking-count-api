import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { AvailabilityInline } from '@/components/Availability';
import { SourceLabel } from '@/components/SourceLabel';
import { Text } from '@/components/Text';
import { color, radius, space } from '@/theme/tokens';
import { formatDistance, formatFreshness, isStale, spotTitle } from '@/utils/format';
import { photoSource } from '@/api/parking';
import type { NearbySpot } from '@/api/types';

interface Props {
  spot: NearbySpot;
  /** Reverse-geocoded street for community rows, which carry no name. */
  areaName?: string;
  /** Community photos are only fetched once the user may actually see them. */
  canShowPhoto: boolean;
  onPress: () => void;
}

/**
 * A list row, not a card. Separation comes from the divider the list draws and
 * from spacing -- wrapping each row in its own rounded surface would turn the
 * sheet into a stack of boxes and bury the availability number.
 */
export const ParkingRow = React.memo(function ParkingRow({ spot, areaName, canShowPhoto, onPress }: Props) {
  const fresh = formatFreshness(spot.timestamp);
  const showPhoto = canShowPhoto && spot.source === 'photo' && !!spot.image;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {showPhoto ? (
        <Image
          source={photoSource(spot.latitude, spot.longitude)}
          style={styles.thumb}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          // Thumbnails are ~56pt; decoding a 4 MB original for each row is what
          // makes a list like this stutter.
          recyclingKey={spot.image ?? undefined}
        />
      ) : null}

      <View style={styles.body}>
        <Text variant="rowTitle" numberOfLines={1}>
          {areaName || spotTitle(spot.name, spot.source)}
        </Text>

        <View style={styles.availability}>
          <AvailabilityInline count={spot.count} />
        </View>

        <View style={styles.meta}>
          <Text variant="meta" tone="tertiary">
            {formatDistance(spot.distance_m)}
          </Text>
          {fresh ? (
            <>
              <Text variant="meta" tone="tertiary" style={styles.dot}>
                ·
              </Text>
              <Text variant="meta" tone={isStale(spot.timestamp) ? 'tertiary' : 'secondary'}>
                {fresh}
              </Text>
            </>
          ) : null}
          <View style={styles.spacer} />
          <SourceLabel source={spot.source} />
        </View>
      </View>

      <View style={styles.chevron} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
  },
  pressed: { backgroundColor: color.surfacePressed },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginRight: space.md,
    backgroundColor: color.surfacePressed,
  },
  body: { flex: 1 },
  availability: { marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  dot: { marginHorizontal: space.xs + 1 },
  spacer: { flex: 1 },
  chevron: {
    width: 7,
    height: 7,
    marginLeft: space.md,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: color.inkTertiary,
    transform: [{ rotate: '45deg' }],
  },
});
