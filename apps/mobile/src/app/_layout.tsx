/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { AlertDialog } from "~/components/AlertDialog";
import { AlertsBar } from "~/components/cms-alert/alerts-container";
import { ConfiguredQueryClientProvider } from "~/components/configured-query-client-provider";
import { PythonMacroProvider } from "~/components/python-macro-provider";
import { TimeSyncProvider } from "~/components/time-sync-provider";
import { ThemeProvider } from "~/context/ThemeContext";
import { useAutoUpload } from "~/hooks/use-auto-upload";
import { useOtaUpdate } from "~/hooks/use-ota-update";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { PostHogProvider } from "~/providers/PostHogProvider";
import { db } from "~/services/db/client";
import { shouldHideSplash } from "~/utils/should-hide-splash";

import migrations from "../../drizzle/migrations";

SplashScreen.preventAutoHideAsync();

function DrizzleDevTools() {
  useDrizzleStudio(db.$client);
  return null;
}

function RootLayoutNav() {
  const theme = useTheme();
  const { colors } = theme;
  const { session, isLoaded } = useSession();

  useEffect(() => {
    if (isLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  const isSignedIn = !!session;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
        headerTintColor: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
        headerTitleStyle: {
          fontWeight: "bold",
          fontFamily: "Poppins-Bold",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
        },
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [retryKey, setRetryKey] = useState(0);

  return <MigrationWrapper key={retryKey} onRetry={() => setRetryKey((k) => k + 1)} />;
}

function MigrationWrapper({ onRetry }: { onRetry: () => void }) {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    "Poppins-Bold": require("../../assets/fonts/Poppins-Bold.ttf"),
    "Overpass-Regular": require("../../assets/fonts/Overpass-Regular.ttf"),
    "Overpass-Medium": require("../../assets/fonts/Overpass-Medium.ttf"),
    "Overpass-Bold": require("../../assets/fonts/Overpass-Bold.ttf"),
    "Overpass-ExtraBold": require("../../assets/fonts/Overpass-ExtraBold.ttf"),
    "Overpass-Black": require("../../assets/fonts/Overpass-Black.ttf"),
  });

  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);

  useOtaUpdate();

  useEffect(() => {
    if (error) {
      console.error(error);
    }
    if (migrationsError) {
      console.error("[db] Migration failed:", migrationsError);
    }
  }, [error, migrationsError]);

  useEffect(() => {
    if (shouldHideSplash(loaded, migrationsReady, migrationsError)) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, migrationsReady, migrationsError]);

  if (migrationsError) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-8">
        <Text className="mb-3 text-xl font-bold text-[#c0392b]">Database Error</Text>
        <Text className="mb-8 text-center text-sm text-[#555]">
          {migrationsError.message ?? "A database migration failed. Please try again."}
        </Text>
        <Pressable className="rounded-lg bg-[#c0392b] px-8 py-3" onPress={onRetry}>
          <Text className="text-base font-semibold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!loaded || !migrationsReady) {
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

function AutoUploadEffect() {
  useAutoUpload();
  return null;
}

// AlertsBar is rendered as an overlay above normal screens.
// The navigator gets extra top padding equal to the alert height minus the real
// status-bar inset, so normal screens sit below the alert without corrupting
// safe-area values for modals.
function AlertsAwareLayout() {
  const insets = useSafeAreaInsets();
  const [alertBarHeight, setAlertBarHeight] = useState(0);

  const navigatorTopPadding = alertBarHeight > 0 ? Math.max(alertBarHeight - insets.top, 0) : 0;

  return (
    <View className="flex-1">
      <View className="flex-1" style={{ paddingTop: navigatorTopPadding }}>
        <RootLayoutNav />
      </View>

      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0"
        onLayout={(e) => setAlertBarHeight(e.nativeEvent.layout.height)}
      >
        <AlertsBar />
      </View>
    </View>
  );
}

function RootLayoutContent() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimeSyncProvider>
        <ConfiguredQueryClientProvider>
          <AutoUploadEffect />
          <SafeAreaProvider>
            <PythonMacroProvider>
              <BottomSheetModalProvider>
                <StatusBar style={theme.isDark ? "light" : "dark"} />
                {__DEV__ && <DrizzleDevTools />}
                <AlertsAwareLayout />
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
