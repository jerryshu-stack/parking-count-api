import React from 'react';
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
  region,
  destination,
  spots,
  selectedKey,
  showsUserLocation,
  onRegionChange,
  onSelect,
  onPressMap,
}: MapCanvasProps) {
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      region={region}
      onRegionChangeComplete={onRegionChange}
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
