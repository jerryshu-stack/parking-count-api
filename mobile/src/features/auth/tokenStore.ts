import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the session token lives.
 *
 * On iOS and Android this is the Keychain / Android Keystore via expo-secure-store,
 * which is the whole point -- a bearer token that never expires server-side must not
 * sit in plain AsyncStorage.
 *
 * expo-secure-store has no web implementation and throws if called there. Web is
 * only the local design-review target for this project, so it falls back to
 * localStorage. That is *not* secure storage; if web ever becomes a shipping
 * target, this fallback needs replacing with an httpOnly cookie session.
 */

const KEY = 'parktogether.session.token';
const web = Platform.OS === 'web';

export async function readToken(): Promise<string | null> {
  try {
    if (web) return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // A device that cannot persist the token still works for this session.
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (web) globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to do -- the in-memory token is cleared by the caller regardless.
  }
}
