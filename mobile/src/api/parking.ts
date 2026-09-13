import { Platform } from 'react-native';

import { api, apiUrl, authHeaders } from './client';
import type {
  GeocodeResult,
  MeResponse,
  NearbyResponse,
  ParkingSpot,
  Place,
  UploadResponse,
} from './types';

/** Nearby parking. Radius is metres; the backend rejects negatives. */
export function fetchNearby(
  latitude: number,
  longitude: number,
  radius: number,
): Promise<NearbyResponse> {
  return api.get<NearbyResponse>('/nearby', { latitude, longitude, radius });
}

export function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>('/me');
}

export function fetchMyContributions(): Promise<ParkingSpot[]> {
  return api.get<ParkingSpot[]>('/me/contributions');
}

/**
 * Community photo bytes. The endpoint needs both headers, so this returns an
 * <Image> source rather than a bare URL -- RN cannot attach headers otherwise.
 */
export function photoSource(latitude: number, longitude: number) {
  return { uri: apiUrl('/image', { latitude, longitude }), headers: authHeaders() };
}

/**
 * Submit a report. The client never sends a count -- the backend's vision model
 * produces it. Generous timeout: inference is synchronous server-side.
 */
export async function uploadReport(params: {
  uri: string;
  latitude: number;
  longitude: number;
  name?: string;
}): Promise<UploadResponse> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    // A browser's FormData stringifies a plain object to '[object Object]'. The
    // {uri,name,type} shape below is a React Native convention, so on web the
    // file has to be read into a real Blob first.
    const blob = await fetch(params.uri).then((r) => r.blob());
    form.append('image', blob, 'report.jpg');
  } else {
    form.append('image', {
      uri: params.uri,
      name: 'report.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }
  form.append('latitude', String(params.latitude));
  form.append('longitude', String(params.longitude));
  if (params.name) form.append('name', params.name);
  return api.postForm<UploadResponse>('/upload', form, 180000);
}

/** Nominatim's display_name is a long comma list; keep the head as the title. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const raw = await api.get<GeocodeResult[]>('/geocode', { q: query });
  return raw
    .map((r) => {
      const parts = r.display_name.split(',').map((p) => p.trim());
      const title = r.name?.trim() || parts[0] || query;
      const rest = parts.filter((p) => p !== title);
      return {
        id: String(r.place_id),
        title,
        // Drop the country and postcode tail -- it is noise for a local search.
        subtitle: rest.slice(0, 3).reverse().join(''),
        latitude: Number(r.lat),
        longitude: Number(r.lon),
      };
    })
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}
