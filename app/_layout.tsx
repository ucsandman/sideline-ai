import { Stack } from 'expo-router';
import { SessionProvider } from '../lib/session';
import { RevenueCatProvider } from '../lib/revenuecat';

export default function RootLayout() {
  return (
    <SessionProvider>
      <RevenueCatProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="paywall"
            options={{ presentation: 'modal', title: 'Sideline AI Pro' }}
          />
        </Stack>
      </RevenueCatProvider>
    </SessionProvider>
  );
}
