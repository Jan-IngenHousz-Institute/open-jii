import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/shared/time/format-time-ago";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

const answersValueStyle = cva("flex-1", {
  variants: {
    hasAnswers: {
      true: "",
      false: "italic",
    },
  },
});

interface CommentModalProps {
  visible: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  experimentName: string;
  questions: AnswerData[];
  timestamp: string;
}

export function CommentModal({
  visible,
  initialText,
  onSave,
  onCancel,
  experimentName,
  questions,
  timestamp,
}: CommentModalProps) {
  const colors = useThemeColors();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const textRef = useRef(initialText);
  const [inputKey, setInputKey] = useState(0);
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      textRef.current = initialText;
      setInputKey((key) => key + 1);
    }
  }, [visible, initialText]);

  const handleSave = () => {
    onSave(textRef.current);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={() => {
        Keyboard.dismiss();
        onCancel();
      }}
      handleIndicatorStyle={{ backgroundColor: colors.inactive }}
      backgroundStyle={{ backgroundColor: colors.card }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      stackBehavior="push"
    >
      <BottomSheetView className="gap-4 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-on-surface text-lg font-bold">
            {t("recentMeasurements:commentModal.title")}
          </Text>

          <TouchableOpacity onPress={onCancel} className="p-1">
            <X size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <View className="bg-muted gap-1.5 rounded-xl p-4">
          <View className="flex-row items-center">
            <Text className="text-on-surface font-semibold">
              {t("recentMeasurements:commentModal.answersLabel")}
            </Text>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx(
                answersValueStyle({ hasAnswers: questions.length > 0 }),
                "text-muted-foreground",
              )}
            >
              {questions.length === 0
                ? t("recentMeasurements:list.noQuestionsAnswered")
                : questions.map((q) => q.question_answer).join(" | ")}
            </Text>
          </View>
          {experimentName && (
            <View className="flex-row items-center">
              <Text className="text-on-surface font-semibold">
                {t("recentMeasurements:commentModal.experimentLabel")}
              </Text>
              <Text numberOfLines={1} ellipsizeMode="tail" className="text-muted-foreground flex-1">
                {experimentName}
              </Text>
            </View>
          )}
          {timestamp && (
            <View className="flex-row items-center">
              <Text className="text-on-surface font-semibold">
                {t("recentMeasurements:commentModal.measurementDoneLabel")}
              </Text>
              <Text numberOfLines={1} ellipsizeMode="tail" className="text-muted-foreground flex-1">
                {formatTimeAgo(timestamp)}
              </Text>
            </View>
          )}
        </View>
        <Input
          key={inputKey}
          asBottomSheet
          defaultValue={initialText}
          onChangeText={(value) => {
            textRef.current = value;
          }}
          placeholder={t("recentMeasurements:commentModal.placeholder")}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 100 }}
          containerStyle={{ marginBottom: 0 }}
        />
        <Button title={t("recentMeasurements:commentModal.saveButton")} onPress={handleSave} />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
