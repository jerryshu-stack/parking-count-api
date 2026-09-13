import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Divider } from '@/components/Divider';
import { Text } from '@/components/Text';
import { color, elevation, radius, space } from '@/theme/tokens';
import type { Place } from '@/api/types';

interface Props {
  results: Place[];
  onSelect: (place: Place) => void;
}

export function SearchResults({ results, onSelect }: Props) {
  return (
    <View style={styles.panel}>
      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" tone="secondary">
            找不到這個地點
          </Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
          {results.map((place, index) => (
            <View key={place.id}>
              {index > 0 ? <Divider inset={space.base} /> : null}
              <Pressable
                onPress={() => onSelect(place)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text variant="rowTitle" numberOfLines={1}>
                  {place.title}
                </Text>
                {place.subtitle ? (
                  <Text variant="meta" tone="tertiary" numberOfLines={1} style={styles.sub}>
                    {place.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: space.sm,
    maxHeight: 260,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation.floating,
  },
  row: { paddingHorizontal: space.base, paddingVertical: space.md },
  pressed: { backgroundColor: color.surfacePressed },
  sub: { marginTop: 2 },
  empty: { padding: space.base },
});
