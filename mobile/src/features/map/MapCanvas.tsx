import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { DestinationPin } from './DestinationPin';
import { SpotMarker } from './SpotMarker';
import { spotKey } from './shared';
import type { MapCanvasProps } from './shared';

/**
 * PROVIDER_DEFAULT gives Apple Maps on iOS, which is the right base map for a
 * Taiwanese mobility product -- its Traditional Chinese labelling and road
 * hierarchy are what local users already read.
 */
export function MapCanvas({
  initialRegion,
  focus,
  destination,
  spots,
  selectedKey,
  showsUserLocation,
  onViewportChange,
  onSelect,
  onPressMap,
}: MapCanvasProps) {
  const map = useRef<MapView>(null);

  // Animating on demand, rather than binding `region`, is deliberate: a controlled
  // region prop fed by onRegionChangeComplete re-applies the region on every pan,
  // so the map animates back under the user's finger and never settles.
  useEffect(() => {
    if (focus) map.current?.animateToRegion(focus, 350);
  }, [focus]);

  return (
    <MapView
      ref={map}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onRegionChangeComplete={onViewportChange}
      onPress={onPressMap}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {destination ? (
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <DestinationPin />
        </Marker>
      ) : null}

      {spots.map((spot) => {
        const key = spotKey(spot);
        return (
          <Marker
            key={key}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            zIndex={selectedKey === key ? 10 : 1}
            onPress={(e) => {
              e.stopPropagation();
              onSelect(spot);
            }}
          >
            <SpotMarker count={spot.count} source={spot.source} selected={selectedKey === key} />
          </Marker>
        );
      })}
    </MapView>
  );
}
