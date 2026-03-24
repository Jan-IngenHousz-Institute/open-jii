/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { AlertDialog } from "~/components/AlertDialog";
import { ConfiguredQueryClientProvider } from "~/components/configured-query-client-provider";
import { PythonMacroProvider } from "~/components/python-macro-provider";
import { TimeSyncProvider } from "~/components/time-sync-provider";
import { ThemeProvider } from "~/context/ThemeContext";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { PostHogProvider } from "~/providers/PostHogProvider";

SplashScreen.preventAutoHideAsync();

function SplashScreenController() {
  const { isLoaded } = useSession();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  return null;
}

function RootLayoutNav() {
  const theme = useTheme();
  const { colors } = theme;
  const { session } = useSession();

  return (
    <>
      <SplashScreenController />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
          },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/login" />
        </Stack.Protected>

        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    "Poppins-Bold": require("../../assets/fonts/Poppins-Bold.ttf"),
    "Overpass-Regular": require("../../assets/fonts/Overpass-Regular.ttf"),
    "Overpass-Medium": require("../../assets/fonts/Overpass-Medium.ttf"),
    "Overpass-Bold": require("../../assets/fonts/Overpass-Bold.ttf"),
    "Overpass-ExtraBold": require("../../assets/fonts/Overpass-ExtraBold.ttf"),
    "Overpass-Black": require("../../assets/fonts/Overpass-Black.ttf"),
  });

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <PostHogProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </PostHogProvider>
  );
}

function RootLayoutContent() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimeSyncProvider>
        <ConfiguredQueryClientProvider>
          <SafeAreaProvider>
            <PythonMacroProvider>
              <BottomSheetModalProvider>
                <StatusBar style={theme.isDark ? "light" : "dark"} />
                <RootLayoutNav />
                <Toaster />
                <AlertDialog />
              </BottomSheetModalProvider>
            </PythonMacroProvider>
          </SafeAreaProvider>
        </ConfiguredQueryClientProvider>
      </TimeSyncProvider>
    </GestureHandlerRootView>
  );
}
