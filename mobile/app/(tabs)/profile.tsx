import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider } from '@/components/Divider';
import { Text } from '@/components/Text';
import { fetchMyContributions } from '@/api/parking';
import { APP_NAME } from '@/api/client';
import { useAuth } from '@/features/auth/AuthContext';
import { color, space } from '@/theme/tokens';

/**
 * Minimal by design. The backend keeps a points balance, but surfacing it would
 * turn a utility into a rewards programme -- the only thing a user needs to know
 * is whether community reports are open to them, so that is the only status here.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username, unlocked, signOut, refresh } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh();
        setCount(await fetchMyContributions().then((r) => r.length).catch(() => null));
      })();
    }, [refresh]),
  );

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ paddingTop: insets.top + space.base, paddingBottom: insets.bottom + space.xxl }}
    >
      <Text variant="title" style={styles.title}>
        我的
      </Text>

      <View style={styles.account}>
        <Text variant="rowTitle">{username ?? '—'}</Text>
        <Text variant="meta" tone="tertiary" style={styles.accountSub}>
          {unlocked ? '已解鎖社群回報' : '尚未解鎖社群回報'}
        </Text>
      </View>

      <Divider />
      <Row
        label="我的回報"
        value={count === null ? '' : `${count} 筆`}
        onPress={() => router.push('/(tabs)/community')}
      />
      <Divider inset={space.lg} />
      <Row label="拍照回報" onPress={() => router.push('/(tabs)/report')} />
      <Divider />

      <Pressable
        onPress={signOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Text variant="rowTitle" style={{ color: color.none }}>
          登出
        </Text>
      </Pressable>
      <Divider />

      <View style={styles.about}>
        <Text variant="caption" tone="tertiary">
          {APP_NAME}・車位資料來源為政府公開資料與社群回報
        </Text>
        <Text variant="caption" tone="tertiary" style={styles.credit}>
          首頁照片：玄史生, Wikimedia Commons, CC BY 2.0
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text variant="rowTitle" style={styles.rowLabel}>
        {label}
      </Text>
      {value ? (
        <Text variant="body" tone="tertiary">
          {value}
        </Text>
      ) : null}
      <View style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  title: { paddingHorizontal: space.lg },

  account: { paddingHorizontal: space.lg, paddingVertical: space.lg },
  accountSub: { marginTop: 3 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.base },
  rowLabel: { flex: 1 },
  pressed: { backgroundColor: color.surfacePressed },
  chevron: {
    width: 7,
    height: 7,
    marginLeft: space.md,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: color.inkTertiary,
    transform: [{ rotate: '45deg' }],
  },

  signOut: { paddingHorizontal: space.lg, paddingVertical: space.base },
  about: { paddingHorizontal: space.lg, paddingTop: space.xl },
  credit: { marginTop: space.xs },
});
