import { onlineManager } from "@tanstack/react-query";
import { Tabs, useRouter, useSegments } from "expo-router";
import { FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentTabIcon } from "~/components/recent-tab-icon";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { DevIndicator } from "~/widgets/dev-indicator";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const { session, isLoaded, error } = useSession();

  // Network errors do not have a status code
  const isNetworkError = useMemo(() => !!error && error.status === undefined, [error]);

  const inMeasureTab = segments.includes("measurement-flow");

  useEffect(() => {
    // Prevent user from being kicked out when network drops
    if (!onlineManager.isOnline()) return;

    // Check if the session error is a network error
    // Even though we are back online, the session fetch might not have been (re)fetched yet
    if (isNetworkError) return;

    // Give better auth time to load
    if (!isLoaded) return;

    // Hooray, we have a session
    if (session) return;

    // No session is present > kick out user
    router.replace("/callback");
  }, [isLoaded, session, router, isNetworkError]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary.dark,
          tabBarInactiveTintColor: theme.isDark ? colors.dark.inactive : colors.light.inactive,
          tabBarStyle: {
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
            borderTopColor: theme.isDark ? colors.dark.border : colors.light.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            display: inMeasureTab ? "none" : "flex",
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
          headerStyle: {
            backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
          },
          headerTintColor: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 24,
          },
          headerShadowVisible: false,
          headerRight: () => <DeviceConnectionWidget />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Connect",
            tabBarIcon: ({ color, size }) => <Bluetooth size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="measurement-flow"
          options={{
            title: "Flow",
            tabBarLabel: "Measure",
            headerTransparent: true,
            headerTintColor: "white",
            headerStyle: {
              backgroundColor: "transparent",
            },
            headerShadowVisible: false,
            tabBarIcon: ({ color, size }) => <Workflow size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="recent-measurements"
          options={{
            title: "Recent",
            tabBarIcon: ({ color, size }) => <RecentTabIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="experiments"
          options={{
            title: "Data",
            tabBarIcon: ({ color, size }) => <FlaskConical size={size} color={color} />,
            href: null,
          }}
        />
        <Tabs.Screen
          name="calibration"
          options={{
            title: "Calibration",
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <DevIndicator size={size} color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
