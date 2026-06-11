/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertsBar } from "~/features/alerts/components/alerts-container";
import { useSession } from "~/features/auth/hooks/use-session";
import { useOtaUpdate } from "~/features/profile/hooks/use-ota-update";
import { AppProviders } from "~/shared/composition/app-providers";
import { db } from "~/shared/db/client";
import { backfillDerivedColumns } from "~/shared/db/measurements-backfill";
import { shouldHideSplash } from "~/shared/device/should-hide-splash";
import { useI18nReady } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { installGlobalErrorHandlers } from "~/shared/ui/error-boundary";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import migrations from "../../drizzle/migrations";

const log = createLogger("root-layout");

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandlers();

function RootLayoutNav() {
  const themeColors = useThemeColors();
  const { session, isLoaded } = useSession();
  const [everLoaded, setEverLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setEverLoaded(true);
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  // Gate on the splash only for the very first load. After that, a transient
  // isLoaded=false (Better Auth re-validating while signing out) must not drop
  // the tree to null — that null frame is the black blink seen on logout.
  if (!isLoaded && !everLoaded) {
    return null;
  }

  const isSignedIn = !!session;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 400,
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen
          name="measurement-flow"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/login" options={{ headerShown: false, animation: "none" }} />
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
      log.error("font load error", { err: error?.message });
    }
    if (migrationsError) {
      log.error("db migration failed", { err: migrationsError?.message });
    }
  }, [error, migrationsError]);

  useEffect(() => {
    if (shouldHideSplash(loaded, migrationsReady, migrationsError)) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, migrationsReady, migrationsError]);

  useEffect(() => {
    if (!migrationsReady) return;
    void backfillDerivedColumns().catch((e) =>
      log.warn("db backfill failed", { err: (e as Error)?.message }),
    );
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
    <AppProviders>
      <ThemedNavigation />
    </AppProviders>
  );
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

function ThemedNavigation() {
  const themeColors = useThemeColors();
  const { colorScheme } = useColorScheme();

  // Theme the navigator container background so instant screen swaps (e.g.
  // logout) don't expose the default white React Navigation background — that
  // gap is what flashes white in dark mode.
  const navBase = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...navBase,
    colors: { ...navBase.colors, background: themeColors.background, card: themeColors.surface },
  };

  // Match the native root view to the in-app theme. The OS-level DayNight
  // window background follows system appearance, so when the app's dark mode
  // is toggled while the OS is light, instant screen swaps (logout) flash the
  // white native root. Painting it the theme background removes that flash.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(themeColors.background);
  }, [themeColors.background]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <AlertsAwareLayout />
    </NavigationThemeProvider>
  );
}
