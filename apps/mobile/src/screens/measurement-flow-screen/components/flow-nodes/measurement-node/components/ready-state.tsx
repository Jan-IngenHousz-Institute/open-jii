import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface ReadyStateProps {
  protocol?: { label: string };
  onStartScan: () => void;
}

export function ReadyState({ protocol, onStartScan }: ReadyStateProps) {
  const { classes } = useTheme();

  return (
    <View className="items-center py-8">
      <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
        Ready to take measurement with protocol: {protocol?.label ?? "Unknown"}
      </Text>
      <Button title="Start Measurement" onPress={onStartScan} style={{ width: "100%" }} />
    </View>
  );
}
