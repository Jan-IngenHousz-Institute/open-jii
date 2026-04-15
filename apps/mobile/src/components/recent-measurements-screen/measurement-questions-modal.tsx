import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { clsx } from "clsx";
import { Clock, FlaskConical, MessageCircle, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
import { useMeasurements } from "~/hooks/use-measurements";
import { useTheme } from "~/hooks/use-theme";
import { parseQuestions } from "~/utils/convert-cycle-answers-to-array";
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
  const { updateMeasurementComment } = useMeasurements();
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

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

  const measurementResult = measurement.data.measurementResult as Record<string, unknown>;
  const questions = parseQuestions(measurement.data.measurementResult);
  const experimentName = measurement.experimentName;
  const protocolName = measurement.data.metadata.protocolName;
  const timestamp = new Date(measurement.timestamp).toLocaleString();
  const isUnsynced = measurement.status === "unsynced";

  const currentComment = getCommentFromMeasurementResult(measurementResult);

  const handleSaveComment = async (text: string) => {
    await updateMeasurementComment(measurement.key, measurement.data, text);
    setCommentModalVisible(false);
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["100%"]}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        onDismiss={onClose}
        handleIndicatorStyle={{ backgroundColor: colors.inactive }}
        topInset={insets.top}
        stackBehavior="push"
      >
        {/* Header */}
        <View
          className={clsx(
            "flex-row items-start justify-between border-b px-4 pb-4 pt-2",
            classes.border,
            classes.background,
          )}
        >
          <View className="mr-3 flex-1">
            <Text className={clsx("text-xl font-bold", classes.text)}>{experimentName}</Text>

            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {protocolName && (
                <View
                  className="max-w-full flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: colors.primary.dark + "15" }}
                >
                  <FlaskConical size={11} color={colors.primary.dark} />
                  <Text
                    className="shrink text-xs font-semibold"
                    style={{ color: colors.primary.dark }}
                  >
                    {protocolName}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-1">
                <Clock size={11} color={colors.inactive} />
                <Text className={clsx("text-xs", classes.textMuted)}>{timestamp}</Text>
              </View>
            </View>
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

        {/* Scrollable Content */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          nestedScrollEnabled
        >
          {questions.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className={clsx("text-center", classes.textSecondary)}>
                No questions answered for this measurement
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              <View className="mb-1 flex-row items-center justify-between">
                <Text
                  className={clsx(
                    "text-xs font-semibold uppercase tracking-wider",
                    classes.textMuted,
                  )}
                >
                  Questions & Answers
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className={clsx("text-xs font-semibold", classes.textMuted)}>
                    {questions.length}
                  </Text>
                </View>
              </View>

              {questions.map((question, index) => (
                <View
                  key={index}
                  className={clsx(
                    "overflow-hidden rounded-xl border",
                    classes.card,
                    classes.border,
                  )}
                >
                  <View className="flex-row items-start gap-3 p-4">
                    <View
                      className="mt-0.5 h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.primary.dark + "15" }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.primary.dark }}>
                        {index + 1}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text
                        className={clsx(
                          "mb-0.5 text-xs font-semibold uppercase tracking-wide",
                          classes.textMuted,
                        )}
                      >
                        {question.question_label}
                      </Text>

                      <Text className={clsx("mb-3 text-sm", classes.text)}>
                        {question.question_text}
                      </Text>

                      <View
                        className="self-start rounded-lg px-3 py-1.5"
                        style={{ backgroundColor: colors.primary.dark + "12" }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: colors.primary.dark }}
                        >
                          {question.question_answer}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <CommentModal
        visible={commentModalVisible}
        initialText={currentComment}
        experimentName={experimentName}
        questions={questions}
        timestamp={measurement.timestamp}
        onSave={handleSaveComment}
        onCancel={() => setCommentModalVisible(false)}
      />
    </>
  );
}
