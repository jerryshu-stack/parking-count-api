/**
 * Response shapes, transcribed from the backend at commit 5eb3269 -- see
 * mobile/ARCHITECTURE.md. These mirror `_spot_to_dict` in main.py exactly; if that
 * changes, this file is the single place the app needs updating.
 */

/** Backend enum. Never shown to the user -- see sourceLabel() in utils/format.ts. */
export type SpotSource = 'taipei-open-data' | 'photo';

export interface ParkingSpot {
  /** Spaces available right now. */
  count: number;
  /** Capacity. Null on community reports -- a photo cannot establish it. */
  total: number | null;
  latitude: number;
  longitude: number;
  /** ISO-8601 Z, second precision. For the government feed this is the feed's own
   *  publish time, so every imported row in a batch shares one value. */
  timestamp: string;
  /** "" when unknown. Government rows always have one. */
  name: string;
  /** Free text, can run to ~300 characters, "" when unknown. Never a number. */
  price: string;
  source: SpotSource;
  /** Stored filename, or null. Not a URL -- fetch bytes via GET /image by coordinate. */
  image: string | null;
}

/** Rows from /nearby carry a server-computed ellipsoidal distance. */
export interface NearbySpot extends ParkingSpot {
  distance_m: number;
}

export interface NearbyResponse {
  /** Community rows are filtered out server-side while the user is locked. */
  spots: NearbySpot[];
  /** How many community rows were withheld. 0 once unlocked. */
  locked_photo_count: number;
}

export interface AuthSession {
  token: string;
  username: string;
  points_balance: number;
}

export interface MeResponse {
  username: string;
  points_balance: number;
  /** The only field the consumer UI actually acts on. */
  unlock_active: boolean;
  unlock_remaining_seconds: number;
  photo_unlock_cost: number;
}

/** POST /upload returns the stored row plus what it earned and unlocked. */
export interface UploadResponse extends ParkingSpot {
  points_balance: number;
  points_awarded: number;
  /** Added alongside the contribution-unlocks-community change. */
  unlock_until?: string;
}

/** Raw Nominatim jsonv2, proxied through /geocode. lat/lon arrive as strings. */
export interface GeocodeResult {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  type?: string;
}

/** What the search UI actually consumes, after parsing and shortening. */
export interface Place {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}
