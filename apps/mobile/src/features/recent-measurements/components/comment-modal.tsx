import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Text, TouchableOpacity, View } from "react-native";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/shared/utils/format-time-ago";

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
  const [text, setText] = useState(initialText);
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setText(initialText);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, initialText]);

  const handleSave = () => {
    onSave(text);
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        sheetRef.current?.dismiss();
        return true; // prevent default navigation
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    return () => subscription.remove();
  }, [visible]);

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
          asBottomSheet
          value={text}
          onChangeText={setText}
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
