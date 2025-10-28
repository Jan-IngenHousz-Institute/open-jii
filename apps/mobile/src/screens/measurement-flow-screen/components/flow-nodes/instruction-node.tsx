import { clsx } from "clsx";
import React from "react";
import { View, Text, Dimensions } from "react-native";
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

  // Calculate responsive height based on screen size
  const screenHeight = Dimensions.get("window").height;
  const responsiveHeight = Math.max(300, Math.min(500, screenHeight * 0.4)); // 40% of screen height, min 300px, max 500px

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Instruction Details</Text>
      </View>

      <View style={{ height: responsiveHeight, flex: 1 }}>
        <HtmlViewer htmlContent={content.text} />
      </View>

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <Button title="Next" onPress={nextStep} style={{ width: "100%" }} />
      </View>
    </View>
  );
}
