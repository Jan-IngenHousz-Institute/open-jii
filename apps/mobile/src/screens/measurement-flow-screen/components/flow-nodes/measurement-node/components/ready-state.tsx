import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface ReadyStateProps {
  protocol?: { label: string };
}

export function ReadyState({ protocol }: ReadyStateProps) {
  const { classes } = useTheme();

  return (
    <View className="items-center py-8">
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
        Ready to take measurement with protocol: {protocol?.label ?? "Unknown"}
      </Text>
    </View>
  );
}
