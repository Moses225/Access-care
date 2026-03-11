import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

// ─── Navigation Guard ─────────────────────────────────────────────────────────
function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, initializing } = useAuth();

  useEffect(() => {
    if (initializing) {
      if (__DEV__) console.log('⏳ Still initializing, not navigating yet...');
      return;
    }

    const currentSegment = segments[0];
    const isOnIndex = !currentSegment || pathname === '/' || pathname === '/index';

    if (__DEV__) {
      console.log('🧭 Navigation check:', {
        user: user ? 'logged in' : 'logged out',
        currentSegment: currentSegment || 'EMPTY',
        pathname,
        isOnIndex,
      });
    }

    const isOnAuthRoute =
      currentSegment === 'welcome' ||
      currentSegment === 'signup' ||
      isOnIndex;

    const isOnProtectedRoute =
      currentSegment === '(tabs)' ||
      currentSegment === 'provider' ||
      currentSegment === 'booking' ||
      currentSegment === 'profile';

    if (user) {
      if (isOnAuthRoute && currentSegment !== '(tabs)') {
        if (__DEV__) console.log('📍 User logged in but on auth page, navigating to main app');
        setTimeout(() => router.replace('/(tabs)'), 100);
      }
      return;
    }

    if (isOnProtectedRoute) {
      if (__DEV__) console.log('📍 User logged out on protected route, navigating to welcome');
      setTimeout(() => router.replace('/welcome'), 100);
      return;
    }

    // Redirect from login screen to welcome screen for fresh opens
    if (isOnIndex) {
      if (__DEV__) console.log('📍 User logged out on index, redirecting to welcome');
      setTimeout(() => router.replace('/welcome'), 100);
    }

  }, [user, segments, pathname, initializing, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
        <ActivityIndicator size="large" color="#2E75B6" />
        <Text style={{ marginTop: 16, color: '#666', fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="provider/[id]" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="profile/appointments" options={{ headerShown: true, title: 'My Appointments', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/saved" options={{ headerShown: true, title: 'Saved Providers', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/insurance" options={{ headerShown: true, title: 'Insurance', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/payments" options={{ headerShown: true, title: 'Payments', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/notifications" options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/privacy" options={{ headerShown: true, title: 'Privacy', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/help" options={{ headerShown: true, title: 'Help', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: true, title: 'Edit Profile', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="profile/theme" options={{ headerShown: true, title: 'Theme Settings', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="qa/index" />
      <Stack.Screen name="admin/qa" options={{ headerShown: true, title: 'Admin Q&A' }} />
      <Stack.Screen name="about" />
    </Stack>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
