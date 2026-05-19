import { Tabs, useSegments } from "expo-router";
import { FlaskConical, House, Settings, Workflow } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeviceSheet } from "~/features/connection/components/device-sheet";
import { useAutoReconnect } from "~/features/connection/hooks/use-auto-reconnect";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { RecentTabIcon } from "~/features/recent-measurements/components/recent-tab-icon";
import { usePruneExpiredMeasurements } from "~/features/recent-measurements/hooks/use-prune-expired-measurements";
import { useTranslation } from "~/shared/i18n";
import { AnimatedTabBar } from "~/shared/ui/animated-tab-bar";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { DevIndicator } from "~/shared/ui/widgets/dev-indicator";
import { DeviceChip } from "~/shared/ui/widgets/device-chip";
import { OpenJiiLogo } from "~/shared/ui/widgets/openjii-logo";

export default function TabLayout() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { t: tHome } = useTranslation("home");
  const hasActiveExperiment = useMeasurementFlowStore((s) => !!s.experimentId);

  useAutoReconnect();
  usePruneExpiredMeasurements();

  // Hide the bar only once an experiment has been selected — keep it visible
  // on the picker so the user can still bail out.
  const inActiveFlow = segments.some((s) => s === "measurement-flow") && hasActiveExperiment;

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} hidden={inActiveFlow} />}
        screenOptions={{
          tabBarActiveTintColor: themeColors.brand,
          tabBarInactiveTintColor: themeColors.inactive,
          tabBarStyle: {
            backgroundColor: themeColors.surface,
            borderTopColor: themeColors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
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
          headerRight: () => <DeviceChip />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: tHome("tab.title"),
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
            headerTitle: () => <OpenJiiLogo height={40} />,
            headerTitleAlign: "left",
          }}
        />
        <Tabs.Screen
          name="measurement-flow"
          options={{
            title: "Flow",
            tabBarLabel: "Measure",
            headerShown: false,
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

      <DeviceSheet />
    </View>
  );
}
