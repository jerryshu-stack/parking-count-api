import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { availabilityColor } from '@/components/Availability';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { SourceLabel } from '@/components/SourceLabel';
import { Text } from '@/components/Text';
import { photoSource } from '@/api/parking';
import { useAuth } from '@/features/auth/AuthContext';
import { SpotMapPreview } from '@/features/parking/SpotMapPreview';
import { useSpot } from '@/hooks/useSpot';
import { color, radius, space } from '@/theme/tokens';
import {
  formatDistance,
  formatFreshnessShort,
  formatWalkingTime,
  spotTitle,
  summarisePrice,
} from '@/utils/format';
import { openDirections } from '@/utils/navigation';

/**
 * One screen serves both sources. The difference is not a different layout but a
 * different amount of truth: a community report has no capacity and no price, so
 * those blocks are absent rather than rendered as "--".
 */
export default function SpotDetail() {
  const params = useLocalSearchParams<{ latitude: string; longitude: string; distance?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unlocked } = useAuth();

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const distance = params.distance ? Number(params.distance) : null;

  const { spot, loading, failed, reload } = useSpot(latitude, longitude);
  const [priceExpanded, setPriceExpanded] = useState(false);

  if (loading) {
    return (
      <View style={[styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.inkTertiary} />
      </View>
    );
  }

  if (failed || !spot) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + space.xxl }]}>
        <CloseButton onPress={() => router.back()} />
        <EmptyState
          title={failed ? '連線失敗，請稍後再試' : '找不到這個車位資訊'}
          actionLabel={failed ? '重新載入' : undefined}
          onAction={failed ? reload : undefined}
        />
      </View>
    );
  }

  const community = spot.source === 'photo';
  const price = summarisePrice(spot.price);
  const metres = distance ?? spot.distance_m;
  const showPhoto = community && unlocked && !!spot.image;

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <CloseButton onPress={() => router.back()} />
        </View>

        <View style={styles.block}>
          <Text variant="heading">{spotTitle(spot.name, spot.source)}</Text>

          {/* Availability is the largest thing on the screen, by a wide margin. */}
          <View style={styles.countRow}>
            <Text variant="display" style={{ color: availabilityColor(spot.count) }}>
              {spot.count}
            </Text>
            <Text variant="body" tone="secondary" style={styles.countUnit}>
              {spot.count === 0 ? '目前已滿' : '個空位'}
            </Text>
          </View>

          {spot.total !== null ? (
            <Text variant="meta" tone="tertiary">
              剩餘車位 {spot.count} / 總車位 {spot.total}
            </Text>
          ) : null}
        </View>

        <View style={styles.factRow}>
          <Fact label="距離" value={formatDistance(metres)} />
          <Fact label="步行" value={formatWalkingTime(metres).replace('步行 ', '')} />
          <Fact label="更新" value={formatFreshnessShort(spot.timestamp) ?? '—'} />
        </View>

        <Divider inset={space.lg} />

        <View style={styles.sourceRow}>
          <SourceLabel source={spot.source} />
        </View>

        {showPhoto ? (
          <View style={styles.block}>
            <Image
              source={photoSource(spot.latitude, spot.longitude)}
              style={styles.photo}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          </View>
        ) : null}

        {price.summary ? (
          <>
            <Divider inset={space.lg} />
            <Pressable
              disabled={!price.hasMore}
              onPress={() => setPriceExpanded((v) => !v)}
              style={styles.block}
            >
              <Text variant="label" tone="tertiary" style={styles.blockLabel}>
                收費方式
              </Text>
              <Text variant="body">{priceExpanded ? spot.price.trim() : price.summary}</Text>
              {price.hasMore ? (
                <Text variant="meta" tone="accent" style={styles.more}>
                  {priceExpanded ? '收合' : '顯示完整費率'}
                </Text>
              ) : null}
            </Pressable>
          </>
        ) : null}

        <View style={styles.preview}>
          <SpotMapPreview
            spot={spot}
            onPress={() => openDirections(spot.latitude, spot.longitude, spot.name || undefined)}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button
          label="在 Google 地圖中開啟"
          onPress={() => openDirections(spot.latitude, spot.longitude, spot.name || undefined)}
        />
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="rowTitle">{value}</Text>
      <Text variant="caption" tone="tertiary" style={styles.factLabel}>
        {label}
      </Text>
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel="關閉" style={styles.close}>
      <View style={styles.chevronLeft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },

  header: { paddingHorizontal: space.base, paddingBottom: space.sm },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevronLeft: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: color.ink,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },

  block: { paddingHorizontal: space.lg, paddingVertical: space.base },
  blockLabel: { marginBottom: space.xs + 2 },

  countRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.md, marginBottom: 2 },
  countUnit: { marginLeft: space.sm },

  factRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingBottom: space.base },
  fact: { flex: 1 },
  factLabel: { marginTop: 2 },

  sourceRow: { paddingHorizontal: space.lg, paddingVertical: space.md },

  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: color.surfacePressed },

  more: { marginTop: space.sm },
  preview: { paddingTop: space.base },

  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
});
