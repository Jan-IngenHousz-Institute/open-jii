import { Tabs, useRouter } from "expo-router";
import { User, FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionStore } from "~/hooks/use-session-store";
import { useTheme } from "~/hooks/use-theme";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isLoaded } = useSessionStore();

  useEffect(() => {
    if (isLoaded && !session?.token) {
      router.replace("/callback");
    }
  }, [isLoaded, session?.token, router]);

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
          name="experiments"
          options={{
            title: "Data",
            tabBarIcon: ({ color, size }) => <FlaskConical size={size} color={color} />,
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
