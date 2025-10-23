import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function CompletedState() {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
        🎉 Flow Completed!
      </Text>
      <Text className={clsx("text-center", classes.textSecondary)}>
        You have successfully completed the measurement flow.
      </Text>
    </View>
  );
}
