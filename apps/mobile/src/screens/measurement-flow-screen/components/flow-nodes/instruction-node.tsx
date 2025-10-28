import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { HtmlViewer } from "~/components/HtmlViewer";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

interface InstructionNodeProps {
  content: {
    text: string;
  };
}

export function InstructionNode({ content }: InstructionNodeProps) {
  const { classes } = useTheme();
  const { nextStep } = useMeasurementFlowStore();

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Instruction Details</Text>
      </View>

      <View className="flex-1 p-4">
        <View className="flex-1">
          <HtmlViewer htmlContent={content.text} />
        </View>
      </View>

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <Button title="Next" onPress={nextStep} style={{ width: "100%" }} />
      </View>
    </View>
  );
}
