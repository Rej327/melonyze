import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";

import { LoadingScreen } from "@/components/loading-screen";
import { AuthProvider, useAuth } from "@/context/auth";
import { FarmProvider } from "@/context/farm";
import { supabase } from "@/lib/supabase";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [deadline, setDeadline] = useState<Date | null>(null);
  const [isTimeBombEnabled, setIsTimeBombEnabled] = useState(false);
  const [isFetchingConfig, setIsFetchingConfig] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "testing_deadline")
          .single();

        if (error) {
          console.error("Error fetching app config from DB:", error.message);
          // Fallback to a safe state if DB fails
          setIsFetchingConfig(false);
          return;
        }

        if (data && data.value) {
          const config = data.value;
          if (config.deadline) {
            let deadlineStr = config.deadline;
            let parsedDate = new Date(deadlineStr);

            // If parsing fails or only time was provided (e.g., "11:23 PM" or "23:23")
            if (isNaN(parsedDate.getTime()) || !deadlineStr.includes("-")) {
              const today = new Date();
              const timeMatch = deadlineStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);

              if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3]?.toUpperCase();

                if (ampm === "PM" && hours < 12) hours += 12;
                if (ampm === "AM" && hours === 12) hours = 0;

                parsedDate = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                  hours,
                  minutes,
                );
              }
            }

            if (!isNaN(parsedDate.getTime())) {
              setDeadline(parsedDate);
              setIsTimeBombEnabled(config.is_enabled);
            }
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching config:", err);
      } finally {
        setIsFetchingConfig(false);
      }
    }

    fetchConfig();

    // Optional: Add a small interval to re-check the "now" time every minute
    // to trigger the lock screen without app restart when time passes
    const timer = setInterval(() => {
      // This forces a re-render to check 'now >= deadline' again
      setDeadline((prev) => (prev ? new Date(prev.getTime()) : null));
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading || isFetchingConfig) return;

    const inAuthGroup = (segments[0] as string) === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/welcome" as any);
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, router, isFetchingConfig]);

  if (loading || isFetchingConfig) {
    return <LoadingScreen />;
  }

  // Time Bomb Logic for Testing
  const now = new Date();

  // DEBUG: If you want to see what's happening, you could log this
  // console.log("Time Check:", { now: now.toLocaleTimeString(), deadline: deadline?.toLocaleTimeString(), enabled: isTimeBombEnabled });

  if (isTimeBombEnabled && deadline && now >= deadline) {
    return (
      <View style={styles.unavailableContainer}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="clock-alert-outline"
            size={80}
            color="#2D6A4F"
          />
        </View>
        <Text style={styles.title}>Testing Access Expired</Text>
        <Text style={styles.message}>
          This test version of Melonyze is no longer available.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BETA TESTING</Text>
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/welcome" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
      <Stack.Screen
        name="(auth)/forgot-password"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="modal"
        options={{ presentation: "modal", title: "Modal", headerShown: true }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  // Force light mode
  useEffect(() => {
    Appearance.setColorScheme("light");
  }, []);

  return (
    <AuthProvider>
      <FarmProvider>
        <ThemeProvider value={DefaultTheme}>
          <RootLayoutNav />
          <StatusBar
            style="light"
            backgroundColor="#2D6A4F"
            translucent={false}
          />
        </ThemeProvider>
      </FarmProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  unavailableContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 30,
  },
  iconContainer: {
    marginBottom: 24,
    backgroundColor: "#DCFCE7",
    padding: 20,
    borderRadius: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    color: "#40916C",
    lineHeight: 24,
    marginBottom: 32,
  },
  badge: {
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
});
