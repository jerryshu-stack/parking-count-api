import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { Text } from '@/components/Text';
import { MapCanvas } from '@/features/map/MapCanvas';
import { spotKey } from '@/features/map/shared';
import { RadiusSelector } from '@/features/map/RadiusSelector';
import { SearchField } from '@/features/map/SearchField';
import { SearchResults } from '@/features/map/SearchResults';
import { LockedCommunityNotice } from '@/features/map/LockedCommunityNotice';
import { ParkingRow, ROW_TEXT_INSET } from '@/features/parking/ParkingRow';
import { ResultFilter, type ResultFilterValue } from '@/features/parking/ResultFilter';
import { RowSkeletonList } from '@/features/parking/RowSkeleton';
import { regionForRadius, thinSpots, type Region } from '@/features/map/thinning';
import { useAuth } from '@/features/auth/AuthContext';
import { FALLBACK_CENTRE, useLocation, type Coords } from '@/hooks/useLocation';
import { useAreaNames } from '@/hooks/useAreaNames';
import { useNearby } from '@/hooks/useNearby';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { searchPlaces } from '@/api/parking';
import type { NearbySpot, Place } from '@/api/types';
import { color, elevation, radius as r, space } from '@/theme/tokens';

// At rest the map keeps ~72% of the screen; the sheet shows its title and the
// nearest result, and the user pulls it up when they want the list.
const SHEET_POINTS = ['30%', '62%', '92%'];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { unlocked, refresh } = useAuth();
  const location = useLocation();

  const [centre, setCentre] = useState<Coords | null>(null);
  const [radiusMetres, setRadiusMetres] = useState(1000);
  const [region, setRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [filter, setFilter] = useState<ResultFilterValue>('all');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);

  const sheet = useRef<BottomSheet>(null);
  const { data, loading, error, reload } = useNearby(centre, radiusMetres);

  // Ask for location the moment the map is first shown -- that is the point at
  // which it becomes useful, and the point at which the reason is obvious.
  useEffect(() => {
    (async () => {
      const coords = await location.request();
      const next = coords ?? FALLBACK_CENTRE;
      setCentre(next);
      setRegion(regionForRadius(next.latitude, next.longitude, 1000));
    })();
  }, []);

  // A contribution made on another tab unlocks community reports; pick that up
  // on return rather than making the user pull to refresh.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const me = await refresh();
        if (me?.unlock_active) reload();
      })();
    }, [refresh, reload]),
  );

  const allSpots = data?.spots ?? [];
  const communityCount = allSpots.filter((s) => s.source === 'photo').length;
  const spots =
    filter === 'available'
      ? allSpots.filter((s) => s.count > 0)
      : filter === 'community'
        ? allSpots.filter((s) => s.source === 'photo')
        : allSpots;
  // Only community rows lack a name, so only they need resolving.
  const areaName = useAreaNames(allSpots.filter((s) => s.source === 'photo'));
  const markers = useMemo(() => thinSpots(allSpots, region), [allSpots, region]);

  const recentre = useCallback(async () => {
    const coords = location.coords ?? (await location.request());
    if (!coords) return;
    setDestination(null);
    setCentre(coords);
    setRegion(regionForRadius(coords.latitude, coords.longitude, radiusMetres));
  }, [location, radiusMetres]);

  const changeRadius = useCallback(
    (metres: number) => {
      setRadiusMetres(metres);
      if (centre) setRegion(regionForRadius(centre.latitude, centre.longitude, metres));
    },
    [centre],
  );

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await searchPlaces(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const choosePlace = useCallback(
    (place: Place) => {
      setDestination(place);
      setCentre({ latitude: place.latitude, longitude: place.longitude });
      setRegion(regionForRadius(place.latitude, place.longitude, radiusMetres));
      setResults(null);
      setQuery('');
    },
    [radiusMetres],
  );

  const openSpot = useCallback(
    (spot: NearbySpot) => {
      router.push({
        pathname: '/spot/[key]',
        params: {
          key: spotKey(spot),
          latitude: String(spot.latitude),
          longitude: String(spot.longitude),
          distance: String(spot.distance_m),
        },
      });
    },
    [router],
  );

  const lockedCount = data?.locked_photo_count ?? 0;

  return (
    <View style={styles.fill}>
      {region ? (
        <MapCanvas
          region={region}
          destination={
            destination
              ? { latitude: destination.latitude, longitude: destination.longitude }
              : null
          }
          spots={markers}
          selectedKey={selected}
          showsUserLocation={location.status === 'granted'}
          onRegionChange={setRegion}
          onSelect={(spot) => {
            setSelected(spotKey(spot));
            openSpot(spot);
          }}
          onPressMap={() => {
            setSelected(null);
            setResults(null);
          }}
        />
      ) : (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={color.inkTertiary} />
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <SearchField
          value={query}
          onChangeText={setQuery}
          onSubmit={runSearch}
          onClear={() => {
            setQuery('');
            setResults(null);
            setDestination(null);
          }}
          loading={searching}
          activePlace={destination?.title ?? null}
        />
        {results ? (
          <SearchResults results={results} onSelect={choosePlace} />
        ) : (
          <View style={styles.radiusRow}>
            <RadiusSelector value={radiusMetres} onChange={changeRadius} />
          </View>
        )}
      </View>

      {!results ? (
        <Pressable
          onPress={recentre}
          accessibilityLabel="使用目前位置"
          style={[styles.locate, { bottom: tabBarHeight + 200 }]}
        >
          <View style={styles.locateRing}>
            <View style={styles.locateDot} />
          </View>
        </Pressable>
      ) : null}

      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={SHEET_POINTS}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBg}
      >
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleRow}>
            <Text variant="heading">附近車位</Text>
            <Text variant="meta" tone="tertiary">
              {loading ? '更新中' : `${spots.length} 個地點`}
            </Text>
          </View>
          <Text variant="meta" tone="tertiary" style={styles.sheetSub}>
            {destination ? `${destination.title} · ` : ''}
            {radiusLabel(radiusMetres)}內 · 依距離排序
          </Text>
        </View>

        <ResultFilter value={filter} onChange={setFilter} communityCount={communityCount} />
        <Divider />

        {lockedCount > 0 ? (
          <LockedCommunityNotice
            count={lockedCount}
            onPress={() => router.push('/(tabs)/report')}
          />
        ) : null}

        <BottomSheetFlatList
          data={spots}
          keyExtractor={(item) => spotKey(item)}
          renderItem={({ item }) => (
            <ParkingRow
              spot={item}
              areaName={areaName(item.latitude, item.longitude)}
              canShowPhoto={unlocked}
              onPress={() => openSpot(item)}
            />
          )}
          ItemSeparatorComponent={() => <Divider inset={ROW_TEXT_INSET} />}
          contentContainerStyle={{ paddingBottom: tabBarHeight + space.lg }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={reload} tintColor={color.inkTertiary} />
          }
          ListEmptyComponent={
            loading ? (
              <RowSkeletonList />
            ) : (
              <EmptyState
                title={error ?? '附近暫時沒有停車資訊'}
                body={error ? undefined : '試著放大搜尋範圍，或移動到其他區域。'}
                actionLabel={error ? '重新載入' : undefined}
                onAction={error ? reload : undefined}
              />
            )
          }
        />
      </BottomSheet>
    </View>
  );
}

function radiusLabel(metres: number): string {
  return metres < 1000 ? `${metres} 公尺` : `${metres / 1000} 公里`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.base },
  radiusRow: { marginTop: space.sm, flexDirection: 'row' },

  locate: {
    position: 'absolute',
    right: space.base,
    width: 44,
    height: 44,
    borderRadius: r.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
  locateRing: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: color.location,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.location },

  sheetBg: { backgroundColor: color.surface },
  handle: { backgroundColor: color.hairlineStrong, width: 36 },
  sheetHeader: { paddingHorizontal: space.lg, paddingBottom: space.md },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sheetSub: { marginTop: 2 },
  listLoading: { paddingVertical: space.xxl, alignItems: 'center' },
});
