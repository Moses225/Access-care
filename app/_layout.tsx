import { Stack, useRouter, useSegments, usePathname } from 'expo-router'; // Add usePathname
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { auth } from '../firebase';
import { ErrorBoundary } from '../components/ErrorBoundary';

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname(); // 🆕 ADD THIS - gets actual current path
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    console.log('👂 Setting up auth listener...');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('🔐 Auth state changed:', currentUser ? '✅ Logged in' : '🔓 Logged out');
      if (currentUser) console.log('   User email:', currentUser.email);
      setUser(currentUser);
      if (initializing) {
        console.log('✓ Initial auth check complete');
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initializing) {
      console.log('⏳ Still initializing, not navigating yet...');
      return;
    }

    const currentSegment = segments[0];

    // 🆕 IMPORTANT: Check actual pathname to handle /index correctly
    const actualPath = pathname || '/';
    const isOnIndex = actualPath === '/' || actualPath === '/index' || (!currentSegment && actualPath === '/');

    console.log('🧭 Navigation check:', {
      user: user ? 'logged in' : 'logged out',
      currentSegment: currentSegment || 'EMPTY',
      pathname: actualPath,
      isOnIndex,
      allSegments: segments,
    });

    // ============================================
    // USER IS LOGGED IN
    // ============================================
    if (user) {
      const inAuthGroup = currentSegment === 'welcome' ||
                         currentSegment === 'signup' ||
                         isOnIndex; // 🆕 Use isOnIndex instead of checking segments

      const inProtectedGroup = currentSegment === '(tabs)' ||
                              currentSegment === 'provider' ||
                              currentSegment === 'booking' ||
                              currentSegment === 'profile';

      if (inAuthGroup) {
        console.log('📍 User logged in but on auth page, navigating to main app');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 100);
        return;
      }

      if (inProtectedGroup) {
        console.log('✓ User logged in on protected route - correct state');
        return;
      }

      // If on some other route, let it be
      console.log('✓ User logged in on other route:', currentSegment || actualPath);
      return;
    }

    // ============================================
    // USER IS LOGGED OUT
    // ============================================
    if (!user) {
      const inAuthGroup = currentSegment === 'welcome' ||
                         currentSegment === 'signup' ||
                         isOnIndex; // 🆕 Use isOnIndex

      const inProtectedGroup = currentSegment === '(tabs)' ||
                              currentSegment === 'provider' ||
                              currentSegment === 'booking' ||
                              currentSegment === 'profile';

      // If on protected route or completely empty (and NOT on index), redirect to welcome
      if (inProtectedGroup) {
        console.log('📍 User logged out on protected route, navigating to welcome');
        setTimeout(() => {
          router.replace('/welcome');
        }, 100);
        return;
      }

      // 🆕 CRITICAL FIX: Don't redirect if we're on an auth page (including index)
      if (inAuthGroup) {
        console.log('✓ User logged out on auth route - correct state');
        return;
      }

      // Only redirect if on unknown route
      console.log('📍 User logged out on unknown route, navigating to welcome');
      setTimeout(() => {
        router.replace('/welcome');
      }, 100);
    }
  }, [user, segments, pathname, initializing, router]); // 🆕 Add pathname to dependencies

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

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
