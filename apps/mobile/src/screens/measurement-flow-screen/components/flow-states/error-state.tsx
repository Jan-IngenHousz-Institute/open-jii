import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function ErrorState() {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("text-center text-red-500", classes.text)}>
        Failed to load experiment flow. Please try again.
      </Text>
    </View>
  );
}
