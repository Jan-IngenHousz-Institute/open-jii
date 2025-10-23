import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface ReadyStateProps {
  onStartFlow: () => void;
}

export function ReadyState({ onStartFlow }: ReadyStateProps) {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
        Ready to Start Flow
      </Text>
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
        Your experiment flow is ready. Click the button below to begin the measurement process.
      </Text>
      <Button title="Start Flow" onPress={onStartFlow} style={{ width: "100%" }} />
    </View>
  );
}
