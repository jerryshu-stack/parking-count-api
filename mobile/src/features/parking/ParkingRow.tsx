import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { availabilityColor } from '@/components/Availability';
import { SourceLabel } from '@/components/SourceLabel';
import { Text } from '@/components/Text';
import { color, radius, space } from '@/theme/tokens';
import { formatDistance, formatFreshness, isStale, spotTitle } from '@/utils/format';
import { photoSource } from '@/api/parking';
import type { ParkingSpot } from '@/api/types';

interface Props {
  spot: ParkingSpot & { distance_m?: number };
  /** Reverse-geocoded street for community rows, which carry no name. */
  areaName?: string;
  /** Community photos are only fetched once the user may actually see them. */
  canShowPhoto: boolean;
  /** Suppressed on lists where every row shares one source, where it is noise. */
  showSource?: boolean;
  onPress: () => void;
}

/** Width of the leading numeric column. Fixed so every row aligns to it. */
const RAIL = 44;

/**
 * A list row, not a card.
 *
 * The count sits in a fixed-width leading column so that scanning the list means
 * running your eye down one rail of numbers rather than re-finding the number
 * inside each row. That column is the row's anchor -- the same job the image does
 * in a restaurant list -- and it is why the count is set much larger and heavier
 * than the name beside it: the name identifies, the number decides.
 */
export const ParkingRow = React.memo(function ParkingRow({
  spot,
  areaName,
  canShowPhoto,
  showSource = true,
  onPress,
}: Props) {
  const fresh = formatFreshness(spot.timestamp);
  const tint = availabilityColor(spot.count);
  const showPhoto = canShowPhoto && spot.source === 'photo' && !!spot.image;

  // Distance leads: in a list sorted by proximity it is the fact being scanned.
  // Contributions fetched from /me/contributions carry no distance, so each part
  // is included only when it exists rather than rendering an empty separator.
  const metaParts = [
    spot.distance_m !== undefined ? formatDistance(spot.distance_m) : null,
    fresh,
    spot.total ? `共 ${spot.total}` : null,
  ].filter(Boolean) as string[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${spotTitle(spot.name, spot.source)}，${spot.count} 個空位`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rail}>
        <Text variant="railCount" style={{ color: tint }}>
          {spot.count}
        </Text>
      </View>

      <View style={styles.body}>
        <Text variant="rowTitle" numberOfLines={1}>
          {areaName || spotTitle(spot.name, spot.source)}
        </Text>

        <View style={styles.meta}>
          <Text variant="meta" tone={isStale(spot.timestamp) ? 'tertiary' : 'secondary'}>
            {metaParts.join(' · ')}
          </Text>
          {showSource ? (
            <>
              <View style={styles.spacer} />
              <SourceLabel source={spot.source} />
            </>
          ) : null}
        </View>
      </View>

      {showPhoto ? (
        <Image
          source={photoSource(spot.latitude, spot.longitude)}
          style={styles.thumb}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={spot.image ?? undefined}
        />
      ) : null}

      <View style={styles.chevron} />
    </Pressable>
  );
});

/** Matches the row's leading inset, so dividers line up with the text column. */
export const ROW_TEXT_INSET = space.lg + RAIL + space.md;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md + 1,
    paddingHorizontal: space.lg,
  },
  pressed: { backgroundColor: color.surfacePressed },

  rail: { width: RAIL, alignItems: 'flex-end', justifyContent: 'center' },

  body: { flex: 1, marginLeft: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  spacer: { flex: 1, minWidth: space.sm },

  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginLeft: space.md,
    backgroundColor: color.surfacePressed,
  },

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
