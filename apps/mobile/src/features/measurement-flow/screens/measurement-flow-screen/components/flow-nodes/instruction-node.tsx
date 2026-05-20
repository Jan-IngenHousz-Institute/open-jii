import { clsx } from "clsx";
import { FileText } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { HtmlViewer } from "~/shared/ui/HtmlViewer";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface InstructionNodeProps {
  content: {
    text: string;
  };
}

export function InstructionNode({ content }: InstructionNodeProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

  const isEmpty = !content || content.text === "<p><br></p>";

  return (
    <View className="flex-1 gap-2 px-4 pt-4">
      <Text className={clsx("text-lg font-bold", classes.text)}>
        {t("measurementFlow:instructionNode.heading")}
      </Text>

      <View className="border-border bg-card flex-1 rounded-lg border p-4">
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
              {t("measurementFlow:instructionNode.empty")}
            </Text>
          </View>
        ) : (
          <HtmlViewer htmlContent={content.text} />
        )}
      </View>
    </View>
  );
}
