import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { color, space } from '@/theme/tokens';

/**
 * Explains the exchange the 社群 tab is built on, because nothing else on screen
 * does: a list of other drivers' photos gives no hint that it exists *because*
 * you contributed, or that contributing is what keeps it open.
 *
 * Numbered because this genuinely is a sequence -- the steps happen in order and
 * each depends on the last. That is the only thing that justifies numerals here;
 * they are not a decorative device.
 *
 * Built from type and one hairline rather than a bordered card: a boxed panel at
 * the top of a list of rows would read as an advertisement sitting above the
 * content instead of as part of the page.
 */

const STEPS = [
  { title: '拍下你看到的車位', body: '系統自動判讀空位數量。' },
  { title: '你的回報立刻上線', body: '附近的駕駛馬上看得到。' },
  { title: '其他回報也對你開放', body: '分享過一次就持續有效。' },
];

export function HowItWorks() {
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="tertiary" style={styles.eyebrow}>
        社群回報如何運作
      </Text>

      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Text variant="stepNumber" tone="tertiary" style={styles.number}>
              {index + 1}
            </Text>
            <View style={styles.stepBody}>
              <Text variant="stepTitle">{step.title}</Text>
              <Text variant="meta" tone="secondary" style={styles.stepText}>
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.base,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  eyebrow: { marginBottom: space.md },
  steps: { gap: space.md + 1 },
  step: { flexDirection: 'row' },
  // Fixed width so the three numerals form a column and the bodies align, the
  // same rail idea the parking rows use.
  number: { width: 24 },
  stepBody: { flex: 1 },
  stepText: { marginTop: 1 },
});
