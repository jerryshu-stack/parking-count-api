import { useCallback, useEffect, useState } from 'react';

import { fetchNearby } from '@/api/parking';
import type { NearbySpot } from '@/api/types';

/**
 * Re-read a single spot from the server rather than passing a snapshot through
 * navigation params. Availability is the whole point of the screen, and a count
 * captured when the list rendered is already stale by the time it is opened.
 *
 * There is no get-one-by-id endpoint -- rows are addressed by coordinate -- so a
 * very small radius around the point is the honest way to ask for it.
 */
export function useSpot(latitude: number, longitude: number) {
  const [spot, setSpot] = useState<NearbySpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { spots } = await fetchNearby(latitude, longitude, 25);
      setSpot(spots[0] ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => { void load(); }, [load]);

  return { spot, loading, failed, reload: load };
}
