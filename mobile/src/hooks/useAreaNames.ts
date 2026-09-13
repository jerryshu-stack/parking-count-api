import { useEffect, useState } from 'react';

import { describeArea } from './useLocation';

/**
 * Street-level names for community reports.
 *
 * The backend stores no name for a photo report -- a driver submitting one has no
 * reason to type an address -- so rows would otherwise all read the same generic
 * fallback. Reverse geocoding is an OS call, not one of ours, and results are
 * cached across renders because the same coordinates recur constantly.
 *
 * Best-effort by design: anything that fails simply keeps the fallback title.
 */
const cache = new Map<string, string>();

const key = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

export function useAreaNames(points: { latitude: number; longitude: number }[]) {
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(cache));

  const signature = points.map((p) => key(p.latitude, p.longitude)).join('|');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const pending = points.filter((p) => !cache.has(key(p.latitude, p.longitude)));
      if (pending.length === 0) return;

      for (const point of pending.slice(0, 12)) {
        const label = await describeArea(point);
        if (cancelled) return;
        // describeArea returns "…附近"; the row already implies proximity.
        if (label) cache.set(key(point.latitude, point.longitude), label.replace(/附近$/, ''));
      }
      if (!cancelled) setNames(Object.fromEntries(cache));
    })();

    return () => { cancelled = true; };
  }, [signature]);

  return (lat: number, lon: number): string | undefined => names[key(lat, lon)];
}
