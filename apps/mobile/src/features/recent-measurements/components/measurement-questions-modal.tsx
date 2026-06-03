import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Clock, Flag, FlaskConical, MessageCircleMore, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommentModal } from "~/features/recent-measurements/components/comment-modal";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { parseQuestions } from "~/shared/measurements/convert-cycle-answers-to-array";
import {
  getCommentFromMeasurementResult,
  getFlagTypeFromMeasurementResult,
} from "~/shared/measurements/measurement-annotations";

interface MeasurementQuestionsModalProps {
  visible: boolean;
  measurement: StoredMeasurement;
  onClose: () => void;
}

export function MeasurementQuestionsModal({
  visible,
  measurement,
  onClose,
}: MeasurementQuestionsModalProps) {
  const colors = useThemeColors();
  const { t } = useTranslation(["common", "recentMeasurements"]);
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
  const experimentName = measurement.data.metadata.experimentName;
  const protocolName = measurement.data.metadata.protocolName;
  const timestamp = new Date(measurement.data.metadata.timestamp).toLocaleString();
  const isUnsynced = measurement.status === "pending" || measurement.status === "failed";

  const [currentComment, setCurrentComment] = useState(() =>
    getCommentFromMeasurementResult(measurementResult),
  );
  const currentFlagType = getFlagTypeFromMeasurementResult(measurementResult);

  const handleSaveComment = async (text: string) => {
    await updateMeasurementComment(measurement.id, measurement.data, text);
    setCurrentComment(text);
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
        backgroundStyle={{ backgroundColor: colors.card }}
        topInset={insets.top}
        stackBehavior="push"
      >
        {/* Header */}
        <View className="border-border flex-row items-start justify-between border-b px-4 pb-4 pt-2">
          <View className="mr-3 flex-1">
            <Text className="text-on-surface text-xl font-bold">{experimentName}</Text>

            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {protocolName && (
                <View
                  className="max-w-full flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: colors.brand + "15" }}
                >
                  <FlaskConical size={11} color={colors.brand} />
                  <Text className="shrink text-xs font-semibold" style={{ color: colors.brand }}>
                    {protocolName}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-1">
                <Clock size={11} color={colors.inactive} />
                <Text className="text-muted-foreground text-xs">{timestamp}</Text>
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
                <MessageCircleMore size={20} color={colors.onSurface} />
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
          {(currentFlagType !== null || currentComment !== "") && (
            <View className="mb-4 gap-2">
              <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                {t("recentMeasurements:questionsModal.annotationsHeading")}
              </Text>

              {currentFlagType && (
                <View className="bg-surface border-border flex-row items-center gap-2 rounded-xl border px-3 py-2">
                  <Flag size={14} color={colors.brand} />
                  <Text className="text-on-surface text-sm font-semibold">
                    {t(`recentMeasurements:flagType.${currentFlagType}`)}
                  </Text>
                </View>
              )}

              {currentComment !== "" && (
                <View className="bg-surface border-border flex-row items-start gap-2 rounded-xl border px-3 py-2">
                  <MessageCircleMore size={14} color={colors.brand} style={{ marginTop: 2 }} />
                  <Text className="text-on-surface flex-1 text-sm">{currentComment}</Text>
                </View>
              )}
            </View>
          )}

          {questions.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-muted-foreground text-center">
                {t("recentMeasurements:questionsModal.noQuestionsAnswered")}
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {t("recentMeasurements:questionsModal.questionsHeading")}
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className="text-muted-foreground text-xs font-semibold">
                    {questions.length}
                  </Text>
                </View>
              </View>

              {questions.map((question, index) => (
                <View
                  key={index}
                  className="bg-surface border-border overflow-hidden rounded-xl border"
                >
                  <View className="flex-row items-start gap-3 p-4">
                    <View
                      className="mt-0.5 h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.brand + "15" }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.brand }}>
                        {index + 1}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-muted-foreground mb-0.5 text-xs font-semibold uppercase tracking-wide">
                        {question.question_label}
                      </Text>

                      <Text className="text-on-surface mb-3 text-sm">{question.question_text}</Text>

                      <View
                        className="self-start rounded-lg px-3 py-1.5"
                        style={{ backgroundColor: colors.brand + "12" }}
                      >
                        <Text className="text-sm font-semibold" style={{ color: colors.brand }}>
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
        timestamp={measurement.data.metadata.timestamp}
        onSave={handleSaveComment}
        onCancel={() => setCommentModalVisible(false)}
      />
    </>
  );
}
