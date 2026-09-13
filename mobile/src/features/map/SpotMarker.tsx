import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { availabilityColor } from '@/components/Availability';
import { color, elevation, radius, space } from '@/theme/tokens';
import type { SpotSource } from '@/api/types';

/**
 * A marker states availability first and source second.
 *
 * The number is the marker -- there is no pin behind it, because a pin would add a
 * second shape to read before the digit. Source is one 5pt dot, not a colour
 * change, so the map never turns into a legend: every marker's colour means
 * "how full", and only that.
 *
 * Selected inverts rather than grows a lot: a large scale jump reads as a toy.
 */
export const SpotMarker = React.memo(function SpotMarker({
  count,
  source,
  selected,
}: {
  count: number;
  source: SpotSource;
  selected: boolean;
}) {
  const tint = availabilityColor(count);
  const community = source === 'photo';

  return (
    <View style={styles.hitbox}>
      <View
        style={[
          styles.chip,
          { borderColor: tint },
          selected && { backgroundColor: tint, borderColor: tint },
        ]}
      >
        <Text
          variant="marker"
          style={[styles.count, { color: selected ? color.inkInverse : tint }]}
        >
          {count}
        </Text>
        {community ? (
          <View
            style={[
              styles.communityDot,
              { backgroundColor: selected ? color.inkInverse : color.accent },
            ]}
          />
        ) : null}
      </View>
      <View style={[styles.stem, { backgroundColor: selected ? tint : color.surface, borderColor: tint }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  // Padding around the visual keeps the touch target comfortable without
  // inflating the drawn marker.
  hitbox: { alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.xs },
  chip: {
    minWidth: 28,
    height: 23,
    paddingHorizontal: space.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1.3,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.marker,
  },
  count: { textAlign: 'center' },
  communityDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: color.surface,
  },
  // A short stem anchors the chip to its coordinate; without it the number floats.
  stem: {
    width: 2,
    height: 5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    marginTop: -1,
  },
});
