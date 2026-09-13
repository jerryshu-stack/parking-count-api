import { Linking, Platform } from 'react-native';

/**
 * Hand the coordinate to Google Maps. We deliberately do not build navigation --
 * the app's job ends at "here is the spot, go".
 *
 * The app scheme is tried first so an installed Google Maps opens directly in
 * directions mode; the universal URL is the fallback and works in a browser, so
 * the user is never left copying numbers.
 */
export async function openDirections(latitude: number, longitude: number, label?: string) {
  const destination = `${latitude},${longitude}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  if (Platform.OS === 'ios') {
    const scheme = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
    if (await Linking.canOpenURL(scheme).catch(() => false)) {
      return Linking.openURL(scheme);
    }
    // Apple Maps is guaranteed present on iOS and is a better fallback than Safari.
    const apple = `http://maps.apple.com/?daddr=${destination}${label ? `&q=${encodeURIComponent(label)}` : ''}`;
    if (await Linking.canOpenURL(apple).catch(() => false)) {
      return Linking.openURL(apple);
    }
  }

  return Linking.openURL(web);
}
