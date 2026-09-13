import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Text } from '@/components/Text';
import { color, space } from '@/theme/tokens';

/** Camera permission is asked for here, at the moment it is needed, not at launch. */
export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const capture = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await camera.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (photo?.uri) {
        router.replace({ pathname: '/report/review', params: { uri: photo.uri } });
      }
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + space.xxl }]}>
        <Cancel onPress={() => router.back()} tone="dark" />
        <EmptyState
          title="需要相機權限才能回報"
          body={
            permission.canAskAgain
              ? '回報車位需要拍一張現場照片，我們只會用它判讀空位數量。'
              : '請到系統設定開啟相機權限，才能拍照回報車位。'
          }
          actionLabel={permission.canAskAgain ? '允許使用相機' : undefined}
          onAction={permission.canAskAgain ? requestPermission : undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Cancel onPress={() => router.back()} tone="light" />
      </View>

      <View style={[styles.shutterBar, { paddingBottom: insets.bottom + space.xl }]}>
        <Text variant="meta" style={styles.hint}>
          把車位拍進畫面即可
        </Text>
        <Pressable
          onPress={capture}
          disabled={busy}
          accessibilityLabel="拍照"
          style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterPressed]}
        >
          <View style={styles.shutterCore} />
        </Pressable>
      </View>
    </View>
  );
}

function Cancel({ onPress, tone }: { onPress: () => void; tone: 'light' | 'dark' }) {
  return (
    <Pressable onPress={onPress} style={styles.cancel} accessibilityLabel="取消">
      <Text variant="button" style={{ color: tone === 'light' ? color.inkInverse : color.ink }}>
        取消
      </Text>
    </Pressable>
  );
}

// The two literals below are deliberate: a viewfinder is black and a shutter is
// white on every camera UI, independent of the app's palette.
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  black: { flex: 1, backgroundColor: '#000000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.base },
  cancel: { paddingHorizontal: space.sm, paddingVertical: space.sm, alignSelf: 'flex-start' },

  shutterBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  hint: { color: 'rgba(255,255,255,0.72)', marginBottom: space.lg },
  shutterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.6 },
  shutterCore: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
});
