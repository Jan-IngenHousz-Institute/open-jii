/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfiguredQueryClientProvider } from "~/components/configured-query-client-provider";
import { ThemeProvider } from "~/context/ThemeContext";
import { ToastProvider } from "~/context/toast-context";
import { useTheme } from "~/hooks/use-theme";

function RootLayoutNav() {
  const theme = useTheme();
  const { colors } = theme;

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
      <Stack.Screen
        name="(auth)/login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
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
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function RootLayoutContent() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <ConfiguredQueryClientProvider>
          <SafeAreaProvider>
            <StatusBar style={theme.isDark ? "light" : "dark"} />
            <RootLayoutNav />
          </SafeAreaProvider>
        </ConfiguredQueryClientProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
