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
/** Points that failed or returned nothing, so they are never asked for twice. */
const missed = new Set<string>();
const GAP_MS = 400;
const PER_PASS = 6;

const key = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

export function useAreaNames(points: { latitude: number; longitude: number }[]) {
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(cache));

  const signature = points.map((p) => key(p.latitude, p.longitude)).join('|');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const pending = points.filter((p) => {
        const k = key(p.latitude, p.longitude);
        return !cache.has(k) && !missed.has(k);
      });
      if (pending.length === 0) return;

      for (const point of pending.slice(0, PER_PASS)) {
        const k = key(point.latitude, point.longitude);
        const label = await describeArea(point);
        if (cancelled) return;
        // describeArea returns "…附近"; the row already implies proximity.
        if (label) cache.set(k, label.replace(/附近$/, ''));
        else missed.add(k);
        await new Promise((r) => setTimeout(r, GAP_MS));
        if (cancelled) return;
      }
      if (!cancelled) setNames(Object.fromEntries(cache));
    })();

    return () => { cancelled = true; };
  }, [signature]);

  return (lat: number, lon: number): string | undefined => names[key(lat, lon)];
}
