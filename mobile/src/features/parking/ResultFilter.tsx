import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { color, radius, space } from '@/theme/tokens';

export type ResultFilterValue = 'all' | 'available' | 'community';

interface Props {
  value: ResultFilterValue;
  onChange: (value: ResultFilterValue) => void;
  /** Hidden entirely when the user has nothing to filter towards. */
  communityCount: number;
}

/**
 * Filters the nearby list. Text with an underline rather than filled pills --
 * these sit directly above the results and a row of solid capsules would out-shout
 * the counts they are filtering.
 *
 * 社群回報 only appears once the user can actually see community rows; offering a
 * filter that always returns nothing would be a worse answer than not offering it.
 */
export function ResultFilter({ value, onChange, communityCount }: Props) {
  const options: { key: ResultFilterValue; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'available', label: '有空位' },
    ...(communityCount > 0 ? [{ key: 'community' as const, label: '社群回報' }] : []),
  ];

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <Text variant="label" tone={active ? 'primary' : 'tertiary'}>
              {option.label}
            </Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.lg, paddingHorizontal: space.lg },
  item: { paddingBottom: space.sm },
  underline: {
    height: 2,
    marginTop: space.xs + 1,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  underlineActive: { backgroundColor: color.ink },
});
