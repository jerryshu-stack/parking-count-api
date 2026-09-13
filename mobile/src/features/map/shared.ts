import type { NearbySpot } from '@/api/types';
import type { Region } from './thinning';

/**
 * Shared by both MapCanvas implementations.
 *
 * This module exists because a platform variant cannot import from its own base
 * name: on web, `./MapCanvas` resolves to MapCanvas.web.tsx itself, so re-exporting
 * through it recurses until the stack dies.
 */

export interface MapCanvasProps {
  /** Frames the map once, on mount. Never re-applied. */
  initialRegion: Region;
  /**
   * A deliberate move -- recentre, radius change, chosen destination. Animated to
   * whenever its identity changes. Panning by hand does not produce one, which is
   * what keeps the map from fighting the user.
   */
  focus: Region | null;
  /** Marks a searched destination, so the map says where it just moved to. */
  destination: { latitude: number; longitude: number } | null;
  spots: NearbySpot[];
  selectedKey: string | null;
  showsUserLocation: boolean;
  /** Reports where the map ended up, for marker thinning only. */
  onViewportChange: (region: Region) => void;
  onSelect: (spot: NearbySpot) => void;
  onPressMap: () => void;
}

/** Rows have no id -- coordinate plus timestamp is what uniquely identifies one. */
export function spotKey(spot: { latitude: number; longitude: number; timestamp: string }) {
  return `${spot.latitude.toFixed(6)},${spot.longitude.toFixed(6)},${spot.timestamp}`;
}
