import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { auth } from '../firebase';

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const [initializing, setInitializing] = useState(true);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth changed:', user ? 'logged in' : 'logged out');
      
      if (initializing) {
        setInitializing(false);
        if (!user && !hasSeenWelcome) {
          setTimeout(() => router.replace('/welcome'), 100);
          setHasSeenWelcome(true);
          return;
        }
      }

      const protectedRoutes = ['(tabs)', 'provider', 'booking', 'profile', 'qa', 'admin', 'about'];
      const isInProtectedRoute = protectedRoutes.some(route => segments[0] === route);
      
      if (user && !isInProtectedRoute && segments[0] !== 'welcome') {
        setTimeout(() => router.replace('/(tabs)'), 100);
      }
      
      if (!user && isInProtectedRoute) {
        setTimeout(() => router.replace('/welcome'), 100);
      }
    });

    return unsubscribe;
  }, [initializing, segments, hasSeenWelcome]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
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
      <Stack.Screen name="profile/payments" options={{ headerShown: true, title: 'Payments', headerBackTitle: 'Profile'  }} />
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
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}