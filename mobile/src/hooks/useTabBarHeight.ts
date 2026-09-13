import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height of the bottom tab bar, including the home-indicator inset.
 *
 * Computed rather than read from @react-navigation/bottom-tabs: expo-router 57
 * dropped react-navigation compatibility, and this is the only number we needed
 * from it. These are the platform defaults the tab bar itself uses.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const base = Platform.OS === 'ios' ? 49 : 56;
  return base + insets.bottom;
}
