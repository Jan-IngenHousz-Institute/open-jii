import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function DemoDisclaimer() {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      className={clsx(
        "mb-4 rounded-lg border p-3",
        theme.isDark ? "border-orange-500 bg-orange-500/20" : "border-orange-500 bg-orange-500/15",
      )}
    >
      <View className="mb-1 flex-row items-center">
        <Text className="mr-1.5 text-sm" style={{ color: colors.semantic.warning }}>
          ⚠️
        </Text>
        <Text className="text-sm font-bold" style={{ color: colors.semantic.warning }}>
          Demo Mode
        </Text>
      </View>
      <Text className={clsx("text-xs leading-4", theme.isDark ? "text-gray-100" : "text-gray-900")}>
        This calibration flow is currently running in demonstration mode. All measurements and
        calculations are simulated for testing purposes only.
      </Text>
    </View>
  );
}
