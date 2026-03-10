import clsx from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const { colors, classes } = useTheme();

  return (
    <View className="flex-row self-center rounded-lg bg-[#EDF2F6] p-1.5">
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
