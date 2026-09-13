import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Text';
import { color, elevation, hitSlop, radius, space } from '@/theme/tokens';
import { text } from '@/theme/type';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading?: boolean;
  /** Shown instead of the placeholder once a destination is chosen. */
  activePlace?: string | null;
}

/** The one thing floating over the map, so it is the one thing with a shadow. */
export function SearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  loading,
  activePlace,
}: Props) {
  const showClear = value.length > 0 || !!activePlace;

  return (
    <View style={styles.wrap}>
      <View style={styles.glyph}>
        <View style={styles.lens} />
        <View style={styles.handle} />
      </View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={activePlace ?? '搜尋目的地'}
        placeholderTextColor={activePlace ? color.ink : color.inkTertiary}
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
      />

      {loading ? <ActivityIndicator size="small" color={color.inkTertiary} /> : null}

      {showClear && !loading ? (
        <Pressable onPress={onClear} hitSlop={hitSlop} accessibilityLabel="清除搜尋">
          <Text variant="meta" tone="tertiary">
            清除
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
    ...elevation.floating,
  },
  input: {
    flex: 1,
    marginLeft: space.sm,
    color: color.ink,
    ...text.input,
    paddingVertical: 0,
    height: '100%',
  },
  // Drawn rather than imported: one glyph is not worth an icon dependency.
  glyph: { width: 15, height: 15, justifyContent: 'center', alignItems: 'center' },
  lens: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: color.inkSecondary,
  },
  handle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 5,
    height: 1.6,
    backgroundColor: color.inkSecondary,
    transform: [{ rotate: '45deg' }],
  },
});
