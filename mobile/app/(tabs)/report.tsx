import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { color, space } from '@/theme/tokens';

/**
 * Intentionally almost empty. The contribution is a photo, so the only job of
 * this screen is to say what will happen and open the camera -- anything else
 * would turn a two-tap action into a form.
 */
export default function ReportIntro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fill, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.copy}>
        <Text variant="title">回報車位</Text>
        <Text variant="body" tone="secondary" style={styles.body}>
          拍張照片，讓附近的駕駛知道這裡還有位置。空位數量由系統自動判讀，你不需要自己數。
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button label="拍張照片" onPress={() => router.push('/report/camera')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.xl },
  // Optically centred rather than top-aligned: with only two lines of copy and a
  // bottom CTA, top alignment leaves a large empty band in the middle of the screen.
  copy: { flex: 1, justifyContent: 'center', paddingBottom: space.xxxl },
  body: { marginTop: space.md, maxWidth: 320 },
  footer: { paddingTop: space.lg },
});
