import { Tabs, useRouter } from "expo-router";
import { FlaskConical, House, Settings, Workflow } from "lucide-react-native";
import { Easing, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeviceSheet } from "~/features/connection/components/device-sheet";
import { useAutoReconnect } from "~/features/connection/hooks/use-auto-reconnect";
import { useDeviceChip } from "~/features/connection/hooks/use-device-chip";
import { RecentTabIcon } from "~/features/recent-measurements/components/recent-tab-icon";
import { usePruneExpiredMeasurements } from "~/features/recent-measurements/hooks/use-prune-expired-measurements";
import { useTranslation } from "~/shared/i18n";
import { AnimatedTabBar } from "~/shared/ui/animated-tab-bar";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { DevIndicator } from "~/shared/ui/widgets/dev-indicator";
import { DeviceChip } from "~/shared/ui/widgets/device-chip";
import { OpenJiiLogo } from "~/shared/ui/widgets/openjii-logo";

// Wired locally so the device/battery subscriptions re-render only the
// chip, not the enclosing header/layout.
function HeaderDeviceChip() {
  return <DeviceChip {...useDeviceChip()} />;
}

export default function TabLayout() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t: tHome } = useTranslation("home");

  useAutoReconnect();
  usePruneExpiredMeasurements();

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} hidden={false} />}
        screenOptions={{
          animation: "fade",
          transitionSpec: {
            animation: "timing",
            config: { duration: 400, easing: Easing.inOut(Easing.ease) },
          },
          sceneStyle: {
            paddingBottom: 60 + insets.bottom,
            backgroundColor: themeColors.background,
          },
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
          headerRight: () => <HeaderDeviceChip />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: tHome("tab.title"),
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
            headerTitle: () => <OpenJiiLogo height={52} />,
            headerTitleAlign: "left",
          }}
        />
        <Tabs.Screen
          name="measure"
          options={{
            title: "Measure",
            tabBarLabel: "Measure",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Workflow size={size} color={color} />,
          }}
          listeners={{
            // Launch the flow as a pushed screen over the tabs (native slide
            // transition) rather than switching into a flat tab scene.
            tabPress: (e) => {
              e.preventDefault();
              router.push("/measurement-flow");
            },
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
