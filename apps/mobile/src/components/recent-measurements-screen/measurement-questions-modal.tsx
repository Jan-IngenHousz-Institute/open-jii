import { clsx } from "clsx";
import { MessageCircle, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { useTheme } from "~/hooks/use-theme";
import type { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/utils/measurement-annotations";

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
  const { updateMeasurementComment } = useFailedUploads();
  const [commentModalVisible, setCommentModalVisible] = useState(false);

  // Extract questions from measurementResult
  const measurementResult = measurement.data.measurementResult as Record<string, unknown>;
  const questions: AnswerData[] = (measurementResult?.questions as AnswerData[]) ?? [];
  const experimentName = measurement.experimentName;
  const timestamp = new Date(measurement.timestamp).toLocaleString();
  const isUnsynced = measurement.status === "unsynced";

  const currentComment = getCommentFromMeasurementResult(measurementResult);

  const handleSaveComment = async (text: string) => {
    await updateMeasurementComment(measurement.key, measurement.data, text);
    setCommentModalVisible(false);
  };

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
          <View className="flex-row items-center gap-2">
            {isUnsynced && (
              <TouchableOpacity
                onPress={() => setCommentModalVisible(true)}
                className="h-10 min-w-[44px] items-center justify-center rounded-full px-2"
                style={{ backgroundColor: colors.surface }}
                activeOpacity={0.7}
              >
                <MessageCircle size={20} color={colors.onSurface} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surface }}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
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

      <CommentModal
        visible={commentModalVisible}
        initialText={currentComment}
        onSave={handleSaveComment}
        onCancel={() => setCommentModalVisible(false)}
      />
    </Modal>
  );
}
