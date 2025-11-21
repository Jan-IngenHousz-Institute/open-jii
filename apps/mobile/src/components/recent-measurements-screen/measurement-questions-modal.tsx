import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import type { AnswerData } from "~/utils/convert-cycle-answers-to-array";

interface MeasurementQuestionsModalProps {
  visible: boolean;
  measurement: MeasurementItem;
  onClose: () => void;
}

export function MeasurementQuestionsModal({
  visible,
  measurement,
  onClose,
}: MeasurementQuestionsModalProps) {
  const { colors, classes } = useTheme();
  const insets = useSafeAreaInsets();

  // Extract questions from measurementResult
  const measurementResult = measurement.data.measurementResult as any;
  const questions: AnswerData[] = measurementResult?.questions ?? [];
  const experimentName = measurement.experimentName;
  const timestamp = new Date(measurement.timestamp).toLocaleString();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View
        className={clsx("flex-1", classes.background)}
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Header */}
        <View
          className={clsx("flex-row items-center justify-between border-b p-4", classes.border)}
        >
          <View className="flex-1">
            <Text className={clsx("text-lg font-bold", classes.text)}>{experimentName}</Text>
            <Text className={clsx("mt-1 text-xs", classes.textMuted)}>{timestamp}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="ml-4 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface }}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {questions.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className={clsx("text-center", classes.textSecondary)}>
                No questions answered for this measurement
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {questions.map((question, index) => (
                <View
                  key={index}
                  className={clsx("rounded-lg border p-4", classes.card, classes.border)}
                >
                  <Text className={clsx("mb-1 text-xs font-semibold uppercase", classes.textMuted)}>
                    {question.question_label}
                  </Text>
                  <Text className={clsx("mb-2 text-base", classes.text)}>
                    {question.question_text}
                  </Text>
                  <View
                    className="rounded-md px-3 py-2"
                    style={{ backgroundColor: colors.primary.dark + "15" }}
                  >
                    <Text className="text-base font-medium" style={{ color: colors.primary.dark }}>
                      {question.question_answer}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
