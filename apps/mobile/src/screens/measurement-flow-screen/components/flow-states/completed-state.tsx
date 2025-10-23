import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface CompletedStateProps {
  iterationCount: number;
  onStartNew: () => void;
}

export function CompletedState({ iterationCount, onStartNew }: CompletedStateProps) {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
        ✅ Flow Finished!
      </Text>
      <Text className={clsx("mb-2 text-center", classes.textSecondary)}>
        You have finished the measurement flow. Thank you for your work!
      </Text>
      <Text className={clsx("mb-6 text-center text-sm", classes.textMuted)}>
        Cycle {iterationCount}
      </Text>
      <Button title="Start New Flow" onPress={onStartNew} style={{ width: "100%" }} />
    </View>
  );
}
