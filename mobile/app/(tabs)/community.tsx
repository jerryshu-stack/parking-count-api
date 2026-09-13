import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvailabilityInline } from '@/components/Availability';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { Text } from '@/components/Text';
import { fetchMyContributions, fetchNearby, photoSource } from '@/api/parking';
import { useAuth } from '@/features/auth/AuthContext';
import { useAreaNames } from '@/hooks/useAreaNames';
import { FALLBACK_CENTRE, useLocation } from '@/hooks/useLocation';
import { color, radius, space } from '@/theme/tokens';
import { formatDistance, formatFreshness, spotTitle } from '@/utils/format';
import type { NearbySpot, ParkingSpot } from '@/api/types';

type Tab = 'latest' | 'mine';

/** A utility list, not a feed: no avatars, no likes, no follower counts. */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unlocked, refresh } = useAuth();
  const location = useLocation();

  const [tab, setTab] = useState<Tab>('latest');
  const [latest, setLatest] = useState<NearbySpot[] | null>(null);
  const [mine, setMine] = useState<ParkingSpot[] | null>(null);
  const [loading, setLoading] = useState(false);

  const rows = tab === 'latest' ? (latest ?? []) : (mine ?? []);
  const areaName = useAreaNames(rows);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await refresh();
      const [contributions, nearby] = await Promise.all([
        fetchMyContributions().catch(() => [] as ParkingSpot[]),
        me?.unlock_active
          ? fetchNearby(
              location.coords?.latitude ?? FALLBACK_CENTRE.latitude,
              location.coords?.longitude ?? FALLBACK_CENTRE.longitude,
              5000,
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      setMine(contributions);
      setLatest(nearby ? nearby.spots.filter((s) => s.source === 'photo') : null);
    } finally {
      setLoading(false);
    }
  }, [refresh, location.coords]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={[styles.fill, { paddingTop: insets.top + space.base }]}>
      <Text variant="title" style={styles.title}>
        社群
      </Text>

      <View style={styles.tabs}>
        <TabButton label="最新回報" active={tab === 'latest'} onPress={() => setTab('latest')} />
        <TabButton label="我的貢獻" active={tab === 'mine'} onPress={() => setTab('mine')} />
      </View>

      {loading && !latest && !mine ? (
        <View style={styles.centre}>
          <ActivityIndicator color={color.inkTertiary} />
        </View>
      ) : tab === 'latest' && !unlocked ? (
        <EmptyState
          title="社群即時回報"
          body="分享一張停車照片，即可查看其他駕駛回報的車位資訊。"
          actionLabel="拍照回報"
          onAction={() => router.push('/(tabs)/report')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.latitude},${item.longitude},${item.timestamp},${i}`}
          ItemSeparatorComponent={() => <Divider inset={space.lg} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          renderItem={({ item }) => (
            <ReportRow
              spot={item}
              areaName={areaName(item.latitude, item.longitude)}
              onPress={() =>
                router.push({
                  pathname: '/spot/[key]',
                  params: {
                    key: `${item.latitude},${item.longitude}`,
                    latitude: String(item.latitude),
                    longitude: String(item.longitude),
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={tab === 'latest' ? '附近尚無社群回報' : '你還沒有回報過車位'}
              body={
                tab === 'latest'
                  ? '成為第一個分享這個區域車位的人。'
                  : '拍一張停車照片，就會出現在這裡。'
              }
              actionLabel="拍照回報"
              onAction={() => router.push('/(tabs)/report')}
            />
          }
        />
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Text variant="rowTitle" tone={active ? 'primary' : 'tertiary'}>
        {label}
      </Text>
      <View style={[styles.underline, active && styles.underlineActive]} />
    </Pressable>
  );
}

function ReportRow({
  spot,
  areaName,
  onPress,
}: {
  spot: ParkingSpot & { distance_m?: number };
  areaName?: string;
  onPress: () => void;
}) {
  const fresh = formatFreshness(spot.timestamp);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {spot.image ? (
        <Image
          source={photoSource(spot.latitude, spot.longitude)}
          style={styles.thumb}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={spot.image}
        />
      ) : null}
      <View style={styles.rowBody}>
        <Text variant="rowTitle" numberOfLines={1}>
          {areaName || spotTitle(spot.name, spot.source)}
        </Text>
        <View style={styles.rowAvailability}>
          <AvailabilityInline count={spot.count} />
        </View>
        <Text variant="meta" tone="tertiary" style={styles.rowMeta}>
          {[fresh, spot.distance_m !== undefined ? formatDistance(spot.distance_m) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  title: { paddingHorizontal: space.lg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', paddingHorizontal: space.lg, marginTop: space.base, gap: space.xl },
  tab: { paddingBottom: space.sm },
  underline: { height: 2, marginTop: space.sm, backgroundColor: 'transparent', borderRadius: 1 },
  underlineActive: { backgroundColor: color.ink },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md },
  pressed: { backgroundColor: color.surfacePressed },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, marginRight: space.md, backgroundColor: color.surfacePressed },
  rowBody: { flex: 1 },
  rowAvailability: { marginTop: 3 },
  rowMeta: { marginTop: 4 },
});
