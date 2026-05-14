import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function LoadingState() {
  const { classes, colors } = useTheme();

  return (
    <View className={clsx("flex-1 justify-center rounded-t-3xl", classes.card, classes.border)}>
      <View className="items-center py-8">
        <ActivityIndicator size="large" color={colors.brand} />
        <Text className={clsx("mt-4 text-center", classes.textSecondary)}>
          Loading experiment flow...
        </Text>
      </View>
    </View>
  );
}
