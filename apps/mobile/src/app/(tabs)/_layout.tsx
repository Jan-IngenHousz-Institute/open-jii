import { Tabs, useRouter } from "expo-router";
import { User, FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentTabIcon } from "~/components/recent-tab-icon";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isLoaded } = useSession();

  useEffect(() => {
    if (isLoaded && !session) {
      router.replace("/callback");
    }
  }, [isLoaded, session, router]);

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
