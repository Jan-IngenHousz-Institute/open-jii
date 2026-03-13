import { clsx } from "clsx";
import { FileText } from "lucide-react-native";
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
  const { classes, colors } = useTheme();

  const isEmpty = !content || content.text === "<p><br></p>";

  return (
    <View className={clsx("flex-1 gap-2 rounded-xl px-4 pt-4")}>
      <Text className={clsx("text-lg font-bold", classes.text)}>Instruction Details</Text>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <View
            className={clsx(
              "mb-4 h-14 w-14 items-center justify-center rounded-full",
              classes.surface,
            )}
          >
            <FileText size={26} color={colors.onSurface} />
          </View>

          <Text className={clsx("text-center text-base font-medium", classes.textSecondary)}>
            No instructions available
          </Text>
        </View>
      ) : (
        <HtmlViewer htmlContent={content.text} />
      )}
    </View>
  );
}
