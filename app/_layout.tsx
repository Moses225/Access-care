import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { registerForPushNotifications } from "../utils/notifications";

import { scrubPII } from "../utils/crashReporting";

Sentry.init({
  dsn: "https://057034210ab85bab34ada8bbe4de9420@o4511057790042112.ingest.us.sentry.io/4511057791746048",
  environment: __DEV__ ? "development" : "production",
  beforeSend: (event) => {
    delete event.user;
    if (event.extra) event.extra = scrubPII(event.extra);
    if (event.contexts) event.contexts = scrubPII(event.contexts);
    return event;
  },
});

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, initializing, isVerifying } = useAuth();
  const isNavigating = useRef(false);
  // Track which UID we've already registered for — prevents re-registering
  // on every render or auth state refresh
  const registeredUidRef = useRef<string | null>(null);

  // ── Register for push notifications when a real user is signed in ─────────
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (registeredUidRef.current === user.uid) return;
    registeredUidRef.current = user.uid;
    // Fire and forget — registration failure should never block the UI
    registerForPushNotifications(user.uid).catch((error) => {
      if (__DEV__)
        console.warn("Push registration failed (non-critical):", error);
    });
  }, [user]);

  useEffect(() => {
    if (initializing) {
      if (__DEV__) console.log("⏳ Still initializing, not navigating yet...");
      return;
    }

    if (isVerifying) {
      if (__DEV__)
        console.log("📧 Verification in progress, skipping navigation");
      return;
    }

    const currentSegment = segments[0];
    if (!currentSegment) return;

    if (__DEV__) {
      console.log("🧭 Navigation check:", {
        user: user ? (user.isAnonymous ? "guest" : "logged in") : "logged out",
        currentSegment: currentSegment || "EMPTY",
        pathname,
      });
    }

    if (isNavigating.current) return;

    const isOnWelcome = currentSegment === "welcome";
    const isOnSignupOrLogin =
      currentSegment === "signup" || currentSegment === "login";
    const isOnAuthRoute = isOnWelcome || isOnSignupOrLogin;
    const isOnOnboarding = currentSegment === "onboarding";
    const isOnProtectedRoute =
      currentSegment === "(tabs)" ||
      currentSegment === "provider" ||
      currentSegment === "booking" ||
      currentSegment === "profile";

    if (user) {
      if (isOnOnboarding) return;

      if (isOnAuthRoute) {
        if (user.isAnonymous && isOnSignupOrLogin) return;

        if (__DEV__)
          console.log("📍 User on auth page, checking onboarding status...");
        isNavigating.current = true;

        if (user.isAnonymous) {
          if (__DEV__) console.log("👤 Guest user, skipping onboarding");
          router.replace("/(tabs)");
          setTimeout(() => {
            isNavigating.current = false;
          }, 500);
          return;
        }

        const onboardingKey = `onboardingComplete_${user.uid}`;
        AsyncStorage.getItem(onboardingKey)
          .then((completed) => {
            if (completed === "true") {
              if (__DEV__)
                console.log("✅ Onboarding already done, going to tabs");
              router.replace("/(tabs)");
            } else {
              if (__DEV__) console.log("🎉 New user, showing onboarding");
              router.replace("/onboarding" as any);
            }
          })
          .catch(() => {
            router.replace("/(tabs)");
          })
          .finally(() => {
            setTimeout(() => {
              isNavigating.current = false;
            }, 500);
          });
      }
      return;
    }

    if (isOnProtectedRoute) {
      if (__DEV__)
        console.log(
          "📍 User logged out on protected route, navigating to welcome",
        );
      isNavigating.current = true;
      router.replace("/welcome");
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    }
  }, [user, segments, pathname, initializing, isVerifying, router]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F5F7FA",
        }}
      >
        <ActivityIndicator size="large" color="#2E75B6" />
        <Text style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="provider/[id]" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen
        name="profile/appointments"
        options={{
          headerShown: true,
          title: "My Appointments",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/saved"
        options={{
          headerShown: true,
          title: "Saved Providers",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/family"
        options={{
          headerShown: true,
          title: "My Family",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/insurance"
        options={{
          headerShown: true,
          title: "Insurance",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/payments"
        options={{
          headerShown: true,
          title: "Payments",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/notifications"
        options={{
          headerShown: true,
          title: "Notifications",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/privacy"
        options={{
          headerShown: true,
          title: "Privacy",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/help"
        options={{
          headerShown: true,
          title: "Help",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{
          headerShown: true,
          title: "Edit Profile",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="profile/theme"
        options={{
          headerShown: true,
          title: "Theme Settings",
          headerBackTitle: "Profile",
        }}
      />
      <Stack.Screen name="qa/index" />
      <Stack.Screen
        name="admin/qa"
        options={{ headerShown: true, title: "Admin Q&A" }}
      />
      <Stack.Screen name="about" />
    </Stack>
  );
}

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
