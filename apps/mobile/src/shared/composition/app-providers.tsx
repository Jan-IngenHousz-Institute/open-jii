import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import type { ReactNode } from "react";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { PythonMacroProvider } from "~/features/measurement-flow/components/python-macro-provider";
import { AlertDialog } from "~/shared/ui/AlertDialog";
import { ConfiguredQueryClientProvider } from "~/shared/ui/configured-query-client-provider";
import { ThemeProvider } from "~/shared/ui/context/ThemeContext";
import { ErrorBoundary } from "~/shared/ui/error-boundary";
import { PostHogProvider } from "~/shared/ui/providers/PostHogProvider";
import { TimeSyncProvider } from "~/shared/ui/time-sync-provider";

import { AppBootstrap } from "./app-bootstrap";

// Composition root for the provider pyramid. Like upload.ts, this is the
// one place (outside src/app) allowed to import feature internals to wire
// the app together; the root layout renders <AppProviders> and stays thin.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <PostHogProvider>
        <ThemeProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <TimeSyncProvider>
              <ConfiguredQueryClientProvider>
                <AppBootstrap />
                <SafeAreaProvider>
                  <PythonMacroProvider>
                    <BottomSheetModalProvider>
                      <ThemedStatusBar />
                      {children}
                      <Toaster />
                      <AlertDialog />
                    </BottomSheetModalProvider>
                  </PythonMacroProvider>
                </SafeAreaProvider>
              </ConfiguredQueryClientProvider>
            </TimeSyncProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}
