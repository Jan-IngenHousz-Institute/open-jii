import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { HtmlViewer } from "~/components/HtmlViewer";
import { useTheme } from "~/hooks/use-theme";

interface InstructionNodeProps {
  content: {
    text: string;
  };
}

export function InstructionNode({ content }: InstructionNodeProps) {
  const { classes } = useTheme();

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Instruction Details</Text>
      </View>

      <HtmlViewer htmlContent={content.text} />
    </View>
  );
}
