import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function LoadingState() {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <View className="items-center py-8">
        <ActivityIndicator size="large" color="#005e5e" />
        <Text className={clsx("mt-4 text-center", classes.textSecondary)}>
          Loading experiment flow...
        </Text>
      </View>
    </View>
  );
}
