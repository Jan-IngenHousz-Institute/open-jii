import { useQueryClient } from "@tanstack/react-query";
import { Tabs, useSegments } from "expo-router";
import { FlaskConical, Settings, Workflow, Bluetooth } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentTabIcon } from "~/components/recent-tab-icon";
import { useAutoReconnect } from "~/hooks/use-auto-reconnect";
import { useThemeColors } from "~/hooks/use-theme-colors";
import { pruneExpiredMeasurements } from "~/services/measurements-storage";
import { DevIndicator } from "~/widgets/dev-indicator";
import { DeviceConnectionWidget } from "~/widgets/device-connection-widget";

export default function TabLayout() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const queryClient = useQueryClient();

  useAutoReconnect();

  useEffect(() => {
    void pruneExpiredMeasurements();
    void queryClient.invalidateQueries({ queryKey: ["measurements"] });
  }, [queryClient]);

  const inMeasureTab = segments.includes("measurement-flow");

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: themeColors.brand,
          tabBarInactiveTintColor: themeColors.inactive,
          tabBarStyle: {
            backgroundColor: themeColors.surface,
            borderTopColor: themeColors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            display: inMeasureTab ? "none" : "flex",
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
          headerStyle: {
            backgroundColor: themeColors.background,
          },
          headerTintColor: themeColors.onSurface,
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
