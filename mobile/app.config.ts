import type { ExpoConfig } from 'expo/config';

// Brand string lives here so it can be changed in one place.
const APP_NAME = 'Parktogether';

const config: ExpoConfig = {
  name: APP_NAME,
  slug: 'parktogether',
  scheme: 'parktogether',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'tw.parktogether.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        '用目前位置尋找附近車位，並標記你回報的車位地點。',
      NSCameraUsageDescription: '拍攝停車位照片，讓系統判讀可停車位數量。',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'tw.parktogether.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#FBFAF7',
    },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'CAMERA'],
  },
  web: { bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#FBFAF7' }],
    'expo-secure-store',
    ['expo-location', { locationWhenInUsePermission: '用目前位置尋找附近車位。' }],
    ['expo-camera', { cameraPermission: '拍攝停車位照片，讓系統判讀可停車位數量。' }],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000',
    apiKey: process.env.EXPO_PUBLIC_API_KEY ?? '',
    appName: APP_NAME,
  },
};

export default config;
