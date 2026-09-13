import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Central Taipei. Only used to frame the map before permission is answered. */
export const FALLBACK_CENTRE: Coords = { latitude: 25.0418, longitude: 121.5354 };

/**
 * Location is requested when it first becomes useful -- entering the map, or
 * starting a report -- not at launch. `request()` is explicit for that reason.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<Coords | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const request = useCallback(async (): Promise<Coords | null> => {
    setStatus('requesting');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        if (mounted.current) setStatus('denied');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      if (mounted.current) {
        setCoords(next);
        setStatus('granted');
      }
      return next;
    } catch {
      if (mounted.current) setStatus('unavailable');
      return null;
    }
  }, []);

  return { status, coords, request };
}

/**
 * Coordinates are for the backend, not the user. A report screen showing
 * "25.03301231, 121.56549810" tells a driver nothing, so we resolve the
 * administrative area instead and fall back to silence, never to raw numbers.
 */
export async function describeArea(coords: Coords): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) return null;
    const district = place.subregion ?? place.city ?? place.region ?? '';
    const street = place.street ?? place.name ?? '';
    const label = `${district}${street}`.trim();
    return label ? `${label}附近` : null;
  } catch {
    return null;
  }
}
