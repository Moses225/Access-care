import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";

/**
 * Rep Portal layout — guards every screen under /rep.
 * Only users with the `rep: true` custom claim can enter.
 * Everyone else is kicked to /welcome.
 */
export default function RepLayout() {
  const { user, initializing, isRep, claimsLoaded } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (initializing || !claimsLoaded) return;

    if (!user || user.isAnonymous) {
      router.replace("/welcome");
      return;
    }

    if (!isRep) {
      // Signed-in patient accidentally hits /rep — send to tabs
      router.replace("/(tabs)");
      return;
    }

    setAuthorized(true);
  }, [user, initializing, isRep, claimsLoaded, router]);

  if (!authorized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA" }}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={{ marginTop: 12, color: "#666", fontSize: 14 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#14B8A6" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Rep Dashboard", headerBackVisible: false }} />
      <Stack.Screen name="submit" options={{ title: "Submit Provider", headerBackTitle: "Dashboard" }} />
      <Stack.Screen name="status" options={{ title: "My Submissions", headerBackTitle: "Dashboard" }} />
    </Stack>
  );
}
