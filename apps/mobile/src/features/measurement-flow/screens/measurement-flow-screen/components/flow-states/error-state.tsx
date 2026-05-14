import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function ErrorState() {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className="text-destructive text-center">
        Failed to load experiment flow. Please try again.
      </Text>
    </View>
  );
}
