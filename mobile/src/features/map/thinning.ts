import type { NearbySpot } from '@/api/types';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Above this, the map is unreadable and the frame cost stops being worth paying. */
const MAX_MARKERS = 60;

/**
 * Reduce markers to what can actually be read at the current zoom.
 *
 * A 5 km radius around central Taipei returns several hundred car parks. Drawing
 * them all produces a wall of overlapping labels and a janky map, so we do two
 * things, in order:
 *
 *   1. Drop anything outside the visible region (with a small margin, so markers
 *      do not pop in at the edge during a pan).
 *   2. Bucket what remains into a grid whose cell is a fixed fraction of the
 *      visible span, and keep one spot per cell. Zooming in shrinks the cell, so
 *      detail reappears naturally without a separate cluster layer.
 *
 * Within a cell the winner is the spot with the most availability -- the marker a
 * driver would actually want to see. A community report wins ties, because it is
 * the scarcer and more perishable information.
 */
export function thinSpots(spots: NearbySpot[], region: Region | null): NearbySpot[] {
  if (!region) return spots.slice(0, MAX_MARKERS);

  const margin = 0.15;
  const latMin = region.latitude - region.latitudeDelta * (0.5 + margin);
  const latMax = region.latitude + region.latitudeDelta * (0.5 + margin);
  const lonMin = region.longitude - region.longitudeDelta * (0.5 + margin);
  const lonMax = region.longitude + region.longitudeDelta * (0.5 + margin);

  const visible = spots.filter(
    (s) =>
      s.latitude >= latMin &&
      s.latitude <= latMax &&
      s.longitude >= lonMin &&
      s.longitude <= lonMax,
  );

  // ~7 cells across the viewport: dense enough to feel populated, sparse enough
  // that two chips never collide at marker width.
  const cellLat = region.latitudeDelta / 7;
  const cellLon = region.longitudeDelta / 7;

  const best = new Map<string, NearbySpot>();
  for (const spot of visible) {
    const key = `${Math.floor(spot.latitude / cellLat)}:${Math.floor(spot.longitude / cellLon)}`;
    const held = best.get(key);
    if (!held || beats(spot, held)) best.set(key, spot);
  }

  return [...best.values()].sort((a, b) => a.distance_m - b.distance_m).slice(0, MAX_MARKERS);
}

function beats(candidate: NearbySpot, held: NearbySpot): boolean {
  if (candidate.count !== held.count) return candidate.count > held.count;
  if (candidate.source !== held.source) return candidate.source === 'photo';
  return candidate.distance_m < held.distance_m;
}

/** Metres-per-degree is latitude-dependent; good enough for framing a region. */
export function regionForRadius(
  latitude: number,
  longitude: number,
  radiusMetres: number,
): Region {
  const latDelta = (radiusMetres * 2.6) / 111_320;
  const lonDelta = latDelta / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return { latitude, longitude, latitudeDelta: latDelta, longitudeDelta: lonDelta };
}
