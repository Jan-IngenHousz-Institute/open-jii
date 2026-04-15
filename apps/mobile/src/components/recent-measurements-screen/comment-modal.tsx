import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Text, TouchableOpacity, View } from "react-native";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/utils/format-time-ago";

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
  readOnly?: boolean;
}

export function CommentModal({
  visible,
  initialText,
  onSave,
  onCancel,
  experimentName,
  questions,
  timestamp,
  readOnly = false,
}: CommentModalProps) {
  const { colors, classes } = useTheme();
  const [text, setText] = useState(initialText);
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setText(initialText);
      sheetRef.current?.present();
    } else {
      Keyboard.dismiss();
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
      onDismiss={onCancel}
      handleIndicatorStyle={{ backgroundColor: colors.inactive }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      stackBehavior="push"
    >
      <BottomSheetView className="gap-4 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className={clsx("text-lg font-bold", classes.text)}>
            {readOnly ? "View comment" : "Add comment"}
          </Text>

          <TouchableOpacity onPress={onCancel} className="p-1">
            <X size={24} color={colors.neutral.black} />
          </TouchableOpacity>
        </View>
        <View className="gap-1.5 rounded-xl bg-[#EDF2F6] p-4">
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>Answers: </Text>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx(
                answersValueStyle({ hasAnswers: questions.length > 0 }),
                classes.textMuted,
              )}
            >
              {questions.length === 0
                ? "No questions answered"
                : questions.map((q) => q.question_answer).join(" | ")}
            </Text>
          </View>
          {experimentName && (
            <View className="flex-row items-center">
              <Text className={clsx("font-semibold", classes.text)}>Experiment: </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className={clsx("flex-1", classes.textMuted)}
              >
                {experimentName}
              </Text>
            </View>
          )}
          {timestamp && (
            <View className="flex-row items-center">
              <Text className={clsx("font-semibold", classes.text)}>Measurement done: </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className={clsx("flex-1", classes.textMuted)}
              >
                {formatTimeAgo(timestamp)}
              </Text>
            </View>
          )}
        </View>
        <BottomSheetTextInput
          value={text}
          onChangeText={readOnly ? undefined : setText}
          editable={!readOnly}
          placeholder="Enter your comment here..."
          placeholderTextColor={colors.inactive}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className={clsx(
            "min-h-[100px] rounded-lg border px-3 py-2 text-base",
            classes.border,
            classes.text,
          )}
          style={{
            backgroundColor: readOnly ? colors.surface : colors.background,
            color: readOnly ? colors.inactive : colors.onSurface,
          }}
        />
        {!readOnly && <Button title="Save comment" onPress={handleSave} />}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
