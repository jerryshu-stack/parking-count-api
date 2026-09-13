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
      // The OS cache answers instantly and is accurate enough to pin a car park.
      // A cold getCurrentPositionAsync can take many seconds indoors, or hang --
      // which is what left the report screen with no coordinate and a submit
      // button that silently did nothing.
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });

      const fresh = cached
        ? null
        : await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
          ]);

      const position = cached ?? fresh;
      if (!position) {
        if (mounted.current) setStatus('unavailable');
        return null;
      }

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
