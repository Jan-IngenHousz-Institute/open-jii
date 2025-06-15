import { Tabs } from "expo-router";
import { Home, User, FlaskConical, Activity } from "lucide-react-native";
import { View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "~/hooks/useTheme";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingBottom: Math.min(insets.bottom, 10) }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary.dark,
          tabBarInactiveTintColor: theme.isDark
            ? colors.dark.inactive
            : colors.light.inactive,
          tabBarStyle: {
            backgroundColor: theme.isDark
              ? colors.dark.surface
              : colors.light.surface,
            borderTopColor: theme.isDark
              ? colors.dark.border
              : colors.light.border,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
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
          },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="experiments"
          options={{
            title: "Experiments",
            tabBarIcon: ({ color, size }) => (
              <FlaskConical size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="measurement"
          options={{
            title: "Measurement",
            tabBarIcon: ({ color, size }) => (
              <Activity size={size} color={color} />
            ),
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
