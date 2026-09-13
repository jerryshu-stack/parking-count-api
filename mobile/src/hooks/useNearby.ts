import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchNearby } from '@/api/parking';
import { ApiError } from '@/api/client';
import type { NearbyResponse } from '@/api/types';

interface State {
  data: NearbyResponse | null;
  loading: boolean;
  /** A phrase ready for display, or null. Never a backend message. */
  error: string | null;
}

/**
 * Nearby results for a centre and radius.
 *
 * Requests are sequenced rather than cancelled: the radius chips can be tapped
 * faster than the round trip, and without a guard a slow earlier response can
 * land after a fast later one and repopulate the map with the wrong radius.
 */
export function useNearby(
  centre: { latitude: number; longitude: number } | null,
  radius: number,
) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!centre) return;
    const ticket = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchNearby(centre.latitude, centre.longitude, radius);
      if (ticket === latest.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (ticket !== latest.current) return;
      const message =
        e instanceof ApiError && e.kind === 'network'
          ? '連線失敗，請稍後再試'
          : '目前無法取得停車資訊';
      setState((s) => ({ data: s.data, loading: false, error: message }));
    }
  }, [centre?.latitude, centre?.longitude, radius]);

  useEffect(() => { void load(); }, [load]);

  return { ...state, reload: load };
}
