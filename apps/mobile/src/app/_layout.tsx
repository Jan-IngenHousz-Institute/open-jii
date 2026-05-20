/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { PythonMacroProvider } from "~/features/measurement-flow/components/python-macro-provider";
import { useOtaUpdate } from "~/features/profile/hooks/use-ota-update";
import { getUploadQueue } from "~/features/recent-measurements/services/upload-queue";
import { db } from "~/shared/db/client";
import { backfillDerivedColumns } from "~/shared/db/measurements-backfill";
import { useI18nReady } from "~/shared/i18n";
import { AlertDialog } from "~/shared/ui/AlertDialog";
import { ConfiguredQueryClientProvider } from "~/shared/ui/configured-query-client-provider";
import { ThemeProvider } from "~/shared/ui/context/ThemeContext";
import { ErrorBoundary, installGlobalErrorHandlers } from "~/shared/ui/error-boundary";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { PostHogProvider } from "~/shared/ui/providers/PostHogProvider";
import { TimeSyncProvider } from "~/shared/ui/time-sync-provider";
import { shouldHideSplash } from "~/shared/utils/should-hide-splash";

import migrations from "../../drizzle/migrations";

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandlers();

function DrizzleDevTools() {
  useDrizzleStudio(db.$client);
  return null;
}

function RootLayoutNav() {
  const themeColors = useThemeColors();
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
          backgroundColor: themeColors.background,
        },
        headerTintColor: themeColors.onSurface,
        headerTitleStyle: {
          fontWeight: "bold",
          fontFamily: "Poppins-Bold",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: themeColors.surface,
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
  const i18nReady = useI18nReady();

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

  useEffect(() => {
    if (!migrationsReady) return;
    void backfillDerivedColumns().catch((e) => console.warn("[db] backfill failed:", e));
  }, [migrationsReady]);

  if (migrationsError) {
    // Recovery fallback. i18n init runs in the same wrapper, so when the
    // migration fails before i18n is ready, t() would return key strings.
    // Keep this UI in English so it always renders something usable.
    return (
      <View className="bg-background flex-1 items-center justify-center p-8">
        <Text className="text-destructive mb-3 text-xl font-bold">Database Error</Text>
        <Text className="text-muted-foreground mb-8 text-center text-sm">
          {migrationsError.message ?? "A database migration failed. Please try again."}
        </Text>
        <Pressable className="bg-destructive rounded-lg px-8 py-3" onPress={onRetry}>
          <Text className="text-destructive-foreground text-base font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!loaded || !migrationsReady || !i18nReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <PostHogProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}

function UploadQueueBootstrap() {
  // Force the upload queue singleton to construct on app start so its
  // network listener, AppState listener, and DB rehydration kick in even
  // before the first user-initiated save.
  getUploadQueue();
  return null;
}

function RootLayoutContent() {
  const { colorScheme } = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimeSyncProvider>
        <ConfiguredQueryClientProvider>
          <UploadQueueBootstrap />
          <SafeAreaProvider>
            <PythonMacroProvider>
              <BottomSheetModalProvider>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                {__DEV__ && <DrizzleDevTools />}
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
