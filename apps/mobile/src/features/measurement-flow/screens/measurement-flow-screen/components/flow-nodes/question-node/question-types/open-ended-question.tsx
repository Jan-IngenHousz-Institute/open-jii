import { ScanQrCode } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { QuestionContent } from "~/shared/measurements/flow-node";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface OpenEndedQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
  onQRPress?: () => void;
}

export function OpenEndedQuestion({ content, value, onChange, onQRPress }: OpenEndedQuestionProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation("measurementFlow");

  return (
    <View className="flex-1 items-start justify-start gap-2">
      <Input
        placeholder={
          content.placeholder ?? t("measurementFlow:questionTypes.openEnded.placeholder")
        }
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={{ minHeight: 200, paddingBottom: 44 }}
        containerStyle={{ marginBottom: 0, width: "100%" }}
        overlay={
          <>
            {value.length > 0 && (
              <TouchableOpacity
                className="bg-gray-background absolute bottom-2 left-2 rounded-md px-2 py-1"
                onPress={() => onChange("")}
              >
                <Text className="text-foreground text-sm font-semibold">
                  {t("measurementFlow:questionTypes.openEnded.clear")}
                </Text>
              </TouchableOpacity>
            )}
            {onQRPress && (
              <TouchableOpacity
                className="bg-gray-background absolute bottom-2 right-2 rounded-md p-1"
                onPress={onQRPress}
              >
                <ScanQrCode size={20} color={themeColors.onSurface} />
              </TouchableOpacity>
            )}
          </>
        }
      />

      {content.required && !value && (
        <Text className="text-destructive text-sm">
          {t("measurementFlow:questionTypes.openEnded.required")}
        </Text>
      )}
    </View>
  );
}
