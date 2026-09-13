import { StyleSheet, View } from 'react-native';

import { color } from '@/theme/tokens';

/**
 * A hairline. `inset` aligns it with row text rather than the screen edge, which is
 * what separates a list from a stack of boxes.
 */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
});
