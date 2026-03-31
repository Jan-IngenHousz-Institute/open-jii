import { useQueryClient } from "@tanstack/react-query";
import { Tabs, useRouter, useSegments } from "expo-router";
import { FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentTabIcon } from "~/components/recent-tab-icon";
import { useAutoReconnect } from "~/hooks/use-auto-reconnect";
import { useIsOnline } from "~/hooks/use-is-online";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { hadActiveSession } from "~/services/session-persistence";
import { pruneExpiredUploads } from "~/services/successful-uploads-storage";
import { DevIndicator } from "~/widgets/dev-indicator";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const { session, isLoaded, error } = useSession();
  const { data: online } = useIsOnline();
  const [hadSession, setHadSession] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    void hadActiveSession().then(setHadSession);
  }, []);

  useAutoReconnect();

  useEffect(() => {
    void pruneExpiredUploads();
  }, []);

  const inMeasureTab = segments.includes("measurement-flow");

  useEffect(() => {
    // Wait for session check and hadSession flag to load
    if (!isLoaded || hadSession === null) return;
    if (session) return;

    // If offline and user previously had a session, trust it —
    // don't kick them to login where they can't do anything.
    // If they never had a session, redirect to login even if offline.
    if (online === false && hadSession) return;
    if (error && hadSession) return;

    router.replace("/callback");
  }, [isLoaded, session, error, hadSession, online, router]);

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
