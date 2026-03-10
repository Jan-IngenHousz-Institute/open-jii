import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function EmptyState() {
  const { classes } = useTheme();

  return (
    <View className={clsx("flex-1 justify-center rounded-t-3xl", classes.card, classes.border)}>
      <Text className={clsx("text-center", classes.textSecondary)}>No flow steps available.</Text>
    </View>
  );
}
