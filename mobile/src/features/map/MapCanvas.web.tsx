import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DestinationPin } from './DestinationPin';
import { SpotMarker } from './SpotMarker';
import { spotKey, type MapCanvasProps } from './shared';
import { color } from '@/theme/tokens';

/**
 * Web-only map. react-native-maps is native-only, and this project has no Xcode
 * and therefore no iOS Simulator, so without this the map screen could not be
 * rendered or screenshotted for design review at all.
 *
 * It is a real slippy map -- OSM raster tiles positioned by the standard Web
 * Mercator transform, markers placed with the same projection -- so spacing,
 * density and marker legibility can be judged honestly. It is a review harness,
 * not shipped product surface: iOS and Android both load MapCanvas.tsx.
 */

const TILE = 256;

function lonToX(lon: number, z: number) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

function latToY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

/** Pick the zoom whose viewport span is closest to the requested region. */
function zoomFor(latitudeDelta: number, heightPx: number) {
  const worldPx = (360 / latitudeDelta) * (heightPx / TILE);
  return Math.max(3, Math.min(18, Math.round(Math.log2(worldPx))));
}

export function MapCanvas({
  region,
  destination,
  spots,
  selectedKey,
  onSelect,
  onPressMap,
}: MapCanvasProps) {
  const [size, setSize] = useState({ width: 390, height: 700 });
  const container = useRef<View>(null);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  }, []);

  const { tiles, project } = useMemo(() => {
    const z = zoomFor(region.latitudeDelta, size.height);
    const scale = Math.pow(2, z);
    const centreX = lonToX(region.longitude, z) * TILE;
    const centreY = latToY(region.latitude, z) * TILE;
    const originX = centreX - size.width / 2;
    const originY = centreY - size.height / 2;

    const first = { x: Math.floor(originX / TILE), y: Math.floor(originY / TILE) };
    const last = {
      x: Math.floor((originX + size.width) / TILE),
      y: Math.floor((originY + size.height) / TILE),
    };

    const list: { key: string; uri: string; left: number; top: number }[] = [];
    for (let x = first.x; x <= last.x; x++) {
      for (let y = first.y; y <= last.y; y++) {
        const wrapped = ((x % scale) + scale) % scale;
        if (y < 0 || y >= scale) continue;
        list.push({
          key: `${z}/${wrapped}/${y}`,
          uri: `https://tile.openstreetmap.org/${z}/${wrapped}/${y}.png`,
          left: x * TILE - originX,
          top: y * TILE - originY,
        });
      }
    }

    return {
      tiles: list,
      project: (lat: number, lon: number) => ({
        left: lonToX(lon, z) * TILE - originX,
        top: latToY(lat, z) * TILE - originY,
      }),
    };
  }, [region, size]);

  return (
    <View ref={container} style={styles.fill} onLayout={onLayout}>
      <Pressable style={styles.fill} onPress={onPressMap}>
        <View style={styles.fill}>
          {tiles.map((t) => (
            <Image
              key={t.key}
              source={{ uri: t.uri }}
              style={[styles.tile, { left: t.left, top: t.top }]}
            />
          ))}
        </View>
      </Pressable>

      {destination
        ? (() => {
            const d = project(destination.latitude, destination.longitude);
            return (
              <View pointerEvents="none" style={[styles.destination, { left: d.left, top: d.top }]}>
                <DestinationPin />
              </View>
            );
          })()
        : null}

      {spots.map((spot) => {
        const key = spotKey(spot);
        const { left, top } = project(spot.latitude, spot.longitude);
        if (left < -60 || top < -60 || left > size.width + 60 || top > size.height + 60) return null;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(spot)}
            style={[
              styles.marker,
              { left, top, zIndex: selectedKey === key ? 10 : 1 },
            ]}
          >
            <SpotMarker count={spot.count} source={spot.source} selected={selectedKey === key} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.bg, overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  destination: { position: 'absolute', transform: [{ translateX: -9 }, { translateY: -9 }] },
  // translate keeps the chip's stem on the coordinate, matching the native anchor.
  marker: { position: 'absolute', transform: [{ translateX: -25 }, { translateY: -37 }] },
});
