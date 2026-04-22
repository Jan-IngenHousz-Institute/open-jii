import { clsx } from "clsx";
import { ScanQrCode } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../../types";

interface OpenEndedQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
  onQRPress?: () => void;
}

export function OpenEndedQuestion({ content, value, onChange, onQRPress }: OpenEndedQuestionProps) {
  const theme = useTheme();
  const { classes, colors } = theme;
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
          className={clsx(
            "min-h-[200px] w-full rounded-lg border p-4 pb-11 text-base",
            classes.input,
            classes.border,
          )}
          placeholder={content.placeholder ?? "Enter your answer..."}
          placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
          value={internal}
          onChangeText={handleChange}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        {/* Clear button */}
        {internal.length > 0 && (
          <TouchableOpacity
            className="absolute bottom-2 left-2 rounded-md p-1"
            style={{
              backgroundColor: theme.isDark
                ? colors.dark.grayBackground
                : colors.light.grayBackground,
            }}
            onPress={handleClear}
          >
            <Text className="font-semibold">Clear text</Text>
          </TouchableOpacity>
        )}

        {/* QR button */}
        {onQRPress && (
          <TouchableOpacity
            className="absolute bottom-2 right-2 rounded-md p-1"
            style={{
              backgroundColor: theme.isDark
                ? colors.dark.grayBackground
                : colors.light.grayBackground,
            }}
            onPress={onQRPress}
          >
            <ScanQrCode size={20} color={colors.neutral.black} />
          </TouchableOpacity>
        )}
      </View>

      {content.required && !value && (
        <Text className={clsx("text-sm text-red-500", classes.text)}>This field is required</Text>
      )}
    </View>
  );
}
