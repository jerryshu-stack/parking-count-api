import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { availabilityColor } from '@/components/Availability';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { ApiError } from '@/api/client';
import { uploadReport } from '@/api/parking';
import { useAuth } from '@/features/auth/AuthContext';
import { describeArea, useLocation, type Coords } from '@/hooks/useLocation';
import { color, radius, space } from '@/theme/tokens';

type Phase =
  | { state: 'ready' }
  | { state: 'uploading' }
  | { state: 'done'; count: number; unlockedNow: boolean }
  | { state: 'failed'; message: string };

export default function ReviewScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unlocked, refresh } = useAuth();
  const location = useLocation();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ state: 'ready' });

  // The coordinate is for the backend; the user sees the place name instead.
  useEffect(() => {
    (async () => {
      const next = await location.request();
      if (!next) return;
      setCoords(next);
      setArea(await describeArea(next));
    })();
  }, []);

  const wasLocked = !unlocked;

  const submit = useCallback(async () => {
    if (!coords || !uri) return;
    setPhase({ state: 'uploading' });
    try {
      const result = await uploadReport({
        uri,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      await refresh();
      setPhase({ state: 'done', count: result.count, unlockedNow: wasLocked });
    } catch (e) {
      const message =
        e instanceof ApiError && e.kind === 'network'
          ? '照片上傳失敗，請再試一次'
          : '照片分析失敗，請換個角度再拍一次';
      setPhase({ state: 'failed', message });
    }
  }, [coords, uri, refresh, wasLocked]);

  if (phase.state === 'done') {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + space.xxxl }]}>
        <View style={styles.result}>
          <Text variant="title">回報成功</Text>

          <View style={styles.countRow}>
            <Text variant="display" style={{ color: availabilityColor(phase.count) }}>
              {phase.count}
            </Text>
            <Text variant="body" tone="secondary" style={styles.countUnit}>
              {phase.count === 0 ? '目前已滿' : '個空位'}
            </Text>
          </View>
          <Text variant="meta" tone="tertiary">
            由系統自動判讀
          </Text>

          {phase.unlockedNow ? (
            <View style={styles.unlocked}>
              <Text variant="label" tone="accent">
                已解鎖附近社群回報
              </Text>
              <Text variant="meta" tone="secondary" style={styles.unlockedSub}>
                現在可以查看其他駕駛回報的車位資訊。
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button label="回到地圖" onPress={() => router.replace('/(tabs)/map')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.cancel}>
          <Text variant="button">取消</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Image source={{ uri }} style={styles.preview} contentFit="cover" transition={120} />

        <View style={styles.locationRow}>
          <View style={styles.pin} />
          <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.locationText}>
            {area ?? (coords ? '已取得目前位置' : '正在取得位置…')}
          </Text>
        </View>

        {phase.state === 'failed' ? (
          <Text variant="meta" style={styles.error}>
            {phase.message}
          </Text>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {phase.state === 'uploading' ? (
          <View style={styles.analysing}>
            <ActivityIndicator color={color.inkSecondary} />
            <Text variant="body" tone="secondary" style={styles.analysingText}>
              正在分析照片…
            </Text>
          </View>
        ) : (
          <>
            <Button
              label={phase.state === 'failed' ? '再試一次' : '送出回報'}
              onPress={submit}
              disabled={!coords}
            />
            <Button
              label="重新拍攝"
              variant="secondary"
              onPress={() => router.replace('/report/camera')}
              style={styles.secondary}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { paddingHorizontal: space.base },
  cancel: { paddingHorizontal: space.sm, paddingVertical: space.sm, alignSelf: 'flex-start' },

  body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.md },
  preview: {
    width: '100%',
    flex: 1,
    maxHeight: 460,
    borderRadius: radius.md,
    backgroundColor: color.surfacePressed,
  },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.base },
  pin: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2.5,
    borderColor: color.inkTertiary,
    marginRight: space.sm,
  },
  locationText: { flex: 1 },
  error: { marginTop: space.md, color: color.none },

  result: { flex: 1, paddingHorizontal: space.xl },
  countRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.xl },
  countUnit: { marginLeft: space.sm },
  unlocked: {
    marginTop: space.xxl,
    padding: space.base,
    borderRadius: radius.md,
    backgroundColor: color.accentSoft,
  },
  unlockedSub: { marginTop: 3 },

  footer: { paddingHorizontal: space.lg, paddingTop: space.md },
  secondary: { marginTop: space.sm },
  analysing: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  analysingText: { marginLeft: space.md },
});
