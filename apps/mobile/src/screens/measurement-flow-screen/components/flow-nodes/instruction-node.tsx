import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface InstructionNodeProps {
  content: {
    text: string;
  };
}

export function InstructionNode({ content }: InstructionNodeProps) {
  const { classes } = useTheme();

  return (
    <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
      <Text className={clsx("mb-4 text-xl font-semibold", classes.text)}>Instruction</Text>
      <Text className={clsx("text-center", classes.textSecondary)}>{content.text}</Text>
    </View>
  );
}
