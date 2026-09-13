import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { color } from '@/theme/tokens';

function RootNavigator() {
  const { ready, username } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!username && !inAuthGroup) router.replace('/(auth)/sign-in');
    else if (username && inAuthGroup) router.replace('/(tabs)/map');
  }, [ready, username, segments, router]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={color.inkTertiary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="(auth)/sign-in" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="spot/[key]" options={{ presentation: 'card' }} />
      <Stack.Screen name="report/camera" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="report/review" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
});
