import clsx from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import React, { ReactNode } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export interface Tab<K extends string = string> {
  key: K;
  label: string;
  /** Optional count rendered as a small badge next to the label. */
  count?: number;
}

export type TabBarVariant = "pill" | "underline";

interface TabBarProps<K extends string = string> {
  tabs: Tab<K>[];
  activeTab: K;
  onTabChange: (key: K) => void;
  variant?: TabBarVariant;
  /** Underline variant only: content rendered inside the bordered row, after the scrollable tabs. */
  trailing?: ReactNode;
}

export function TabBar<K extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  variant = "pill",
  trailing,
}: TabBarProps<K>) {
  if (variant === "underline") {
    return (
      <UnderlineTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        trailing={trailing}
      />
    );
  }
  return <PillTabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}

function PillTabBar<K extends string = string>({ tabs, activeTab, onTabChange }: TabBarProps<K>) {
  const { colors, classes } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
    >
      <View className="bg-muted flex-row rounded-lg p-1.5">
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
    </ScrollView>
  );
}

function UnderlineTabBar<K extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  trailing,
}: TabBarProps<K>) {
  return (
    <View className="flex-row items-end">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
        <View className="flex-row">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => onTabChange(tab.key)}
                activeOpacity={0.7}
                // Mirrors Tailwind UI's "Tabs with underline and badges":
                //   `-mb-px flex space-x-8` + `border-b-2 px-1 py-4 text-sm font-medium`
                className={clsx(
                  "mr-8 flex-row items-center border-b-2 px-1 pb-4 pt-3",
                  isActive ? "border-primary" : "border-transparent",
                )}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className={clsx(
                    "text-[14px] font-medium",
                    isActive ? "text-primary" : "text-muted-body",
                  )}
                >
                  {tab.label}
                </Text>
                {typeof tab.count === "number" && (
                  <View
                    className={clsx(
                      "ml-2 items-center justify-center rounded-full px-2",
                      isActive ? "bg-jii-mint" : "bg-muted",
                    )}
                    style={{ minWidth: 22, height: 20 }}
                  >
                    <Text
                      className={clsx(
                        "text-[11px] font-medium",
                        isActive ? "text-primary" : "text-on-surface",
                      )}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      {trailing ? <View className="pb-3 pl-3">{trailing}</View> : null}
    </View>
  );
}
