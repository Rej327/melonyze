// import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
// import { Stack, useRouter, useSegments } from "expo-router";
// import { StatusBar } from "expo-status-bar";
// import { useEffect } from "react";
// import { Appearance } from "react-native";
// import "react-native-reanimated";

// import { LoadingScreen } from "@/components/loading-screen";
// import { AuthProvider, useAuth } from "@/context/auth";
// import { FarmProvider } from "@/context/farm";

// export const unstable_settings = {
//   anchor: "(tabs)",
// };

// function RootLayoutNav() {
//   const { session, loading } = useAuth();
//   const segments = useSegments();
//   const router = useRouter();

//   useEffect(() => {
//     if (loading) return;

//     const inAuthGroup = (segments[0] as string) === "(auth)";

//     if (!session && !inAuthGroup) {
//       // Redirect to welcome if not authenticated
//       router.replace("/(auth)/welcome" as any);
//     } else if (session && inAuthGroup) {
//       // Redirect to home if authenticated and trying to access auth screens
//       router.replace("/(tabs)");
//     }
//   }, [session, loading, segments, router]);

//   if (loading) {
//     return <LoadingScreen />;
//   }

//   return (
//     <Stack screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
//       <Stack.Screen name="(auth)/welcome" options={{ headerShown: false }} />
//       <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
//       <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
//       <Stack.Screen
//         name="(auth)/forgot-password"
//         options={{ headerShown: false }}
//       />
//       <Stack.Screen
//         name="modal"
//         options={{ presentation: "modal", title: "Modal", headerShown: true }}
//       />
//     </Stack>
//   );
// }

// export default function RootLayout() {
//   // Force light mode
//   useEffect(() => {
//     Appearance.setColorScheme("light");
//   }, []);

//   return (
//     <AuthProvider>
//       <FarmProvider>
//         <ThemeProvider value={DefaultTheme}>
//           <RootLayoutNav />
//           <StatusBar
//             style="light"
//             backgroundColor="#2D6A4F"
//             translucent={false}
//           />
//         </ThemeProvider>
//       </FarmProvider>
//     </AuthProvider>
//   );
// }
