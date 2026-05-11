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
import { AlertDialog } from "~/components/AlertDialog";
import { ConfiguredQueryClientProvider } from "~/components/configured-query-client-provider";
import { PythonMacroProvider } from "~/components/python-macro-provider";
import { TimeSyncProvider } from "~/components/time-sync-provider";
import { ThemeProvider } from "~/context/ThemeContext";
import { useAutoUpload } from "~/hooks/use-auto-upload";
import { useOtaUpdate } from "~/hooks/use-ota-update";
import { useSession } from "~/hooks/use-session";
import { useThemeColors } from "~/hooks/use-theme-colors";
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

function RootLayoutContent() {
  const { colorScheme } = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimeSyncProvider>
        <ConfiguredQueryClientProvider>
          <AutoUploadEffect />
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
