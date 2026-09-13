import { StyleSheet, View } from 'react-native';

import { color } from '@/theme/tokens';

export type TabName = 'map' | 'report' | 'community' | 'profile';

/**
 * Tab glyphs drawn from primitives rather than pulled from an icon set. Four
 * simple shapes do not justify a font or SVG dependency, and drawing them keeps
 * the stroke weight consistent with the rest of the chrome.
 */
export function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  const tint = focused ? color.ink : color.inkTertiary;
  const stroke = focused ? 2 : 1.6;

  if (name === 'map') {
    return (
      <View style={styles.box}>
        <View style={[styles.mapSheet, { borderColor: tint, borderWidth: stroke }]} />
        <View style={[styles.mapFold, { backgroundColor: tint }]} />
      </View>
    );
  }

  if (name === 'report') {
    return (
      <View style={styles.box}>
        <View style={[styles.cameraBody, { borderColor: tint, borderWidth: stroke }]} />
        <View style={[styles.cameraLens, { borderColor: tint, borderWidth: stroke }]} />
      </View>
    );
  }

  if (name === 'community') {
    return (
      <View style={styles.box}>
        <View style={[styles.personHead, { borderColor: tint, borderWidth: stroke }]} />
        <View style={[styles.personBody, { borderColor: tint, borderWidth: stroke }]} />
        <View style={[styles.personSide, { borderColor: tint, borderWidth: stroke }]} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={[styles.profileHead, { borderColor: tint, borderWidth: stroke }]} />
      <View style={[styles.profileBody, { borderColor: tint, borderWidth: stroke }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },

  mapSheet: { width: 20, height: 16, borderRadius: 2 },
  mapFold: { position: 'absolute', width: 1.4, height: 16, opacity: 0.55 },

  cameraBody: { width: 20, height: 15, borderRadius: 3 },
  cameraLens: { position: 'absolute', width: 7.5, height: 7.5, borderRadius: 4 },

  personHead: { width: 7, height: 7, borderRadius: 3.5, marginBottom: 1, marginLeft: -5 },
  personBody: { width: 12, height: 7, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomWidth: 0, marginLeft: -5 },
  personSide: { position: 'absolute', right: 2, width: 9, height: 13, borderRadius: 5, opacity: 0.5 },

  profileHead: { width: 8, height: 8, borderRadius: 4, marginBottom: 1.5 },
  profileBody: { width: 15, height: 8, borderTopLeftRadius: 7.5, borderTopRightRadius: 7.5, borderBottomWidth: 0 },
});
