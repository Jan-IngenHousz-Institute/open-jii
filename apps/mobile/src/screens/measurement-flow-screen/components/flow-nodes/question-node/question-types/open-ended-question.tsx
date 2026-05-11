import { ScanQrCode } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { colors } from "~/constants/colors";
import { useThemeColors } from "~/hooks/use-theme-colors";

import { QuestionContent } from "../../../../types";

interface OpenEndedQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
  onQRPress?: () => void;
}

export function OpenEndedQuestion({ content, value, onChange, onQRPress }: OpenEndedQuestionProps) {
  const themeColors = useThemeColors();
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  const handleChange = (text: string) => {
    setInternal(text);
    onChange(text);
  };

  const handleClear = () => {
    setInternal("");
    onChange("");
  };

  return (
    <View className="flex-1 items-start justify-start gap-2">
      <View className="relative w-full">
        <TextInput
          className="border-border bg-card text-on-surface min-h-[200px] w-full rounded-lg border p-4 pb-11 text-base"
          placeholder={content.placeholder ?? "Enter your answer..."}
          placeholderTextColor={themeColors.inactive}
          value={internal}
          onChangeText={handleChange}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        {internal.length > 0 && (
          <TouchableOpacity
            className="bg-gray-background absolute bottom-2 left-2 rounded-md p-1"
            onPress={handleClear}
          >
            <Text className="text-foreground font-semibold">Clear text</Text>
          </TouchableOpacity>
        )}

        {onQRPress && (
          <TouchableOpacity
            className="bg-gray-background absolute bottom-2 right-2 rounded-md p-1"
            onPress={onQRPress}
          >
            <ScanQrCode size={20} color={colors.neutral.black} />
          </TouchableOpacity>
        )}
      </View>

      {content.required && !value && (
        <Text className="text-sm text-red-500">This field is required</Text>
      )}
    </View>
  );
}
