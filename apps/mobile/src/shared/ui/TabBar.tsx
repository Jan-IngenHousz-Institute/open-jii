import clsx from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export interface Tab<K extends string = string> {
  key: K;
  label: string;
}

interface TabBarProps<K extends string = string> {
  tabs: Tab<K>[];
  activeTab: K;
  onTabChange: (key: K) => void;
}

export function TabBar<K extends string = string>({
  tabs,
  activeTab,
  onTabChange,
}: TabBarProps<K>) {
  const { colors, classes } = useTheme();

  return (
    <View className="bg-muted flex-row self-center rounded-lg p-1.5">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className="overflow-hidden rounded-md"
            activeOpacity={0.7}
          >
            {isActive ? (
              <LinearGradient
                colors={["#002F2F", "#005E5E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text
                  className="text-center text-base font-semibold"
                  style={{ color: colors.onPrimary }}
                >
                  {tab.label}
                </Text>
              </LinearGradient>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text className={clsx("text-base font-medium", classes.textMuted)}>
                  {tab.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
