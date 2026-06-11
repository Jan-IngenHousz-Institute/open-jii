import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import type { ReactNode } from "react";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { AlertDialog } from "~/shared/ui/AlertDialog";
import { ConfiguredQueryClientProvider } from "~/shared/ui/configured-query-client-provider";
import { ThemeProvider } from "~/shared/ui/context/ThemeContext";
import { ErrorBoundary } from "~/shared/ui/error-boundary";

import { db } from "~/shared/db/client";

// Composition root for the ALWAYS-ON provider pyramid (theme, query client,
// sheets, toasts) — everything the force-update gate itself needs to render.
// Gated app services (analytics, time sync, outbox, macros) live in
// allowed-app-services.tsx and mount only once the gate allows.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ConfiguredQueryClientProvider>
            <SafeAreaProvider>
              <BottomSheetModalProvider>
                <ThemedStatusBar />
                {__DEV__ && <DrizzleDevTools />}
                {children}
                <Toaster />
                <AlertDialog />
              </BottomSheetModalProvider>
            </SafeAreaProvider>
          </ConfiguredQueryClientProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

function DrizzleDevTools() {
  useDrizzleStudio(db.$client);
  return null;
}
