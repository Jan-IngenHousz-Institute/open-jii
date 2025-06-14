import { Tabs } from "expo-router";
import { Home, Beaker, User } from "lucide-react-native";
import React from "react";
import { useTheme } from "~/hooks/useTheme";

export default function TabLayout() {
  const theme = useTheme();
  const { colors } = theme;

  return (
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
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 4,
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
          tabBarIcon: ({ color, size }) => <Beaker size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="measurement"
        options={{
          title: "Measurement",
          tabBarIcon: ({ color, size }) => <Beaker size={size} color={color} />,
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
  );
}
