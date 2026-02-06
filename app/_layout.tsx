import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/auth";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = (segments[0] as string) === "(auth)";

    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/(auth)/login" as any);
    } else if (session && inAuthGroup) {
      // Redirect to home if authenticated and trying to access auth screens
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{ presentation: "modal", title: "Modal", headerShown: true }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DefaultTheme}>
        <RootLayoutNav />
        <StatusBar
          style="light"
          backgroundColor="#2D6A4F"
          translucent={false}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}
