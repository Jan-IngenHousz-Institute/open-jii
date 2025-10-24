import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface ErrorStateProps {
  error: any;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { classes } = useTheme();

  return (
    <View className="items-center py-8">
      <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
        Measurement Failed
      </Text>
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
        {error?.message ?? "An error occurred during measurement"}
      </Text>
      <Button title="Retry Measurement" onPress={onRetry} style={{ width: "100%" }} />
    </View>
  );
}
