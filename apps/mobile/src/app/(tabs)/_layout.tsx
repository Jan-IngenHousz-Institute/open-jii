import { Tabs, useRouter } from "expo-router";
import { User, FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentTabIcon } from "~/components/recent-tab-icon";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { DevIndicator } from "~/widgets/dev-indicator";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";
import { onlineManager } from "@tanstack/react-query";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isLoaded, error } = useSession();

  useEffect(() => {
    // Prevent user from being kicked out when network drops
    if(!onlineManager.isOnline()) return 

    // Check if the session error is a network error
    // Even though we are back online, the session fetch might not have been (re)fetched yet
    const isNetworkError = !!error && error.status === undefined // Network errors do not have a status
    if(isNetworkError) return

    // Give better auth time to load
    if(!isLoaded) return

    // Hooray, we have a session
    if(session) return

    // No session is present > kick out user
    router.replace("/callback");
  }, [isLoaded, session, router, error?.status]);

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
          },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={{ alignItems: "flex-start", gap: 6, marginRight: 16 }}>
              <DevIndicator />
              <DeviceConnectionWidget />
            </View>
          ),
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
            title: "Measure",
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
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}