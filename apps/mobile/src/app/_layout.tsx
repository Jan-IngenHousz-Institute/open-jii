/* eslint-disable @typescript-eslint/no-require-imports */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { ThemeProvider } from "~/context/ThemeContext";
import { useTheme } from "~/hooks/useTheme";

export const unstable_settings = {
  initialRouteName: "(auth)/login",
};

// Root layout wrapper with theme provider
export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    // Load JII Design System fonts
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
      throw error;
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

// Content component that uses the theme
function RootLayoutContent() {
  const theme = useTheme();
  const { colors } = theme;
  const backgroundColor = theme.isDark
    ? colors.dark.background
    : colors.light.background;

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <RootLayoutNav />
    </View>
  );
}

function RootLayoutNav() {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
        headerTintColor: theme.isDark
          ? colors.dark.onSurface
          : colors.light.onSurface,
        headerTitleStyle: {
          fontWeight: "bold",
          fontFamily: "Poppins-Bold",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
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
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="design-system"
        options={{
          title: "JII Design System",
        }}
      />
    </Stack>
  );
}
