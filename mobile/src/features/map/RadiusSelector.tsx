import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { color, radius as r, space } from '@/theme/tokens';
import { RADIUS_OPTIONS } from '@/utils/format';

interface Props {
  value: number;
  onChange: (metres: number) => void;
}

/**
 * Deliberately quiet: a secondary control that sits under the search field
 * without competing with it. Only the selected chip gets a surface; the rest are
 * plain text on the map.
 */
export function RadiusSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {RADIUS_OPTIONS.map((option) => {
        const active = option.metres === value;
        return (
          <Pressable
            key={option.metres}
            onPress={() => onChange(option.metres)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && !active && styles.chipPressed,
            ]}
          >
            <Text variant="caption" tone={active ? 'inverse' : 'secondary'} style={styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.tight },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.tight,
    borderRadius: r.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  chipActive: { backgroundColor: color.ink },
  chipPressed: { backgroundColor: color.surfacePressed },
  label: { fontWeight: '500' },
});
