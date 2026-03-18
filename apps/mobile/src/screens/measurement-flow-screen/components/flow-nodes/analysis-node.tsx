import { clsx } from "clsx";
import { CircleCheckBig, ChevronUp } from "lucide-react-native";
import { DateTime } from "luxon";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from "react-native";
import { Button } from "~/components/Button";
import { MeasurementResult } from "~/components/measurement-result/measurement-result";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import { useExperiments } from "~/hooks/use-experiments";
import { useMacro } from "~/hooks/use-macro";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useProtocol } from "~/hooks/use-protocol";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

interface AnalysisNodeProps {
  content: {
    params: Record<string, any>;
    macroId: string;
  };
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes, colors } = useTheme();
  const { macro, isLoading } = useMacro(content.macroId);
  const {
    scanResult,
    previousStep,
    experimentId,
    protocolId,
    finishFlow,
    iterationCount,
    flowNodes,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();

  const experimentName =
    experiments.find((experiment) => experiment.value === experimentId)?.label ?? "Experiment";

  const { getCycleAnswers } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);

  const { isUploading, uploadMeasurement } = useMeasurementUpload();
  const { protocol } = useProtocol(protocolId);

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Capture the display timestamp once so it stays stable across re-renders.
  // The upload handler captures its own fresh timestamp independently.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scanResult is an intentional trigger to re-capture the timestamp on new scans
  const displayTimestamp = useMemo(() => getSyncedLocalISO(), [scanResult]);

  const renderContent = () => {
    if (!scanResult) {
      return (
        <View className="items-center py-8">
          <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
            No Measurement Data
          </Text>
          <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
            Please complete the measurement step first
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View className="items-center py-8">
          <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
            Loading Macro...
          </Text>
        </View>
      );
    }

    if (!macro) {
      return (
        <View className="items-center py-8">
          <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
            Macro Not Found
          </Text>
          <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
            Macro ID: {content.macroId}
          </Text>
        </View>
      );
    }

    return (
      <MeasurementResult
        rawMeasurement={scanResult}
        macro={macro}
        onCommentPress={() => setCommentModalVisible(true)}
      />
    );
  };

  const handleUploadMeasurement = async () => {
    if (!scanResult) {
      return;
    }

    if (!experimentId) {
      throw new Error("Missing experiment id");
    }

    if (!protocolId) {
      throw new Error("Missing protocol id");
    }

    if (!session?.data?.user?.id) {
      throw new Error("Missing user id");
    }

    if (!macro?.id || !macro?.name || !macro?.filename) {
      throw new Error("Missing macro information");
    }

    // Capture timestamp/timezone at upload time so the sync service
    // has had a chance to complete its first sync.
    // NOTE: timestamp === normalized UTC timestamp (never a local time with offset suffix).
    // The timezone field is what enables local-time derivation downstream.
    const timestamp = getSyncedUtcISO();
    const timezone = getTimeSyncState().timezone;

    const cycleAnswers = getCycleAnswers(iterationCount);
    const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    await uploadMeasurement({
      rawMeasurement: scanResult,
      timestamp,
      timezone,
      experimentName,
      experimentId,
      protocolId,
      userId: session?.data?.user?.id,
      macro: {
        id: macro.id,
        name: macro.name,
        filename: macro.filename,
      },
      questions,
      commentText: measurementComment.trim() || undefined,
    });
    finishFlow();
  };

  const handleRetry = () => {
    previousStep();
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setHasScrolled(offsetY > 50);
  }, []);

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View className="flex-1 px-4 pt-4">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        onScroll={handleScroll}
        showsVerticalScrollIndicator={true}
      >
        <View className="flex-row items-center gap-2">
          <Text className={clsx("text-lg font-bold", classes.text)}>Measurement complete</Text>
          <CircleCheckBig size={16} />
        </View>

        <View className="my-4 gap-1.5 rounded-xl bg-[#EDF2F6] p-4">
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
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>Protocol: </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx("flex-1", classes.textMuted)}
            >
              {protocol?.name ?? "Protocol"}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>Answers: </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx("flex-1", classes.textMuted)}
            >
              {questions.length === 0
                ? "None"
                : questions.map((q) => q.question_answer).join(" | ")}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>Date: </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx("flex-1", classes.textMuted)}
            >
              {DateTime.fromISO(displayTimestamp).toFormat("d MMMM yyyy, HH:mm")}
            </Text>
          </View>
        </View>

        <View>{renderContent()}</View>
      </ScrollView>

      {hasScrolled ? (
        <View className="w-full items-start py-3">
          <TouchableOpacity
            onPress={scrollToTop}
            className={clsx("-ml-4 h-[44px] flex-row items-center justify-end gap-1 px-4")}
            activeOpacity={0.7}
          >
            <ChevronUp size={20} color={colors.onSurface} />
            <Text className={clsx("text-lg font-medium", classes.text)}>Scroll to top</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row gap-4 py-3">
          <Button
            title="Discard & retry"
            onPress={handleRetry}
            variant="tertiary"
            style={{ flex: 1, height: 44, borderColor: "transparent" }}
          />
          <Button
            title={isUploading ? "Uploading..." : "Accept data"}
            onPress={() => handleUploadMeasurement().catch(console.log)}
            disabled={isUploading}
            style={{ flex: 1, height: 44 }}
          />
        </View>
      )}

      <CommentModal
        visible={commentModalVisible}
        initialText={measurementComment}
        experimentName={experimentName}
        questions={questions}
        timestamp={displayTimestamp}
        onSave={(text) => {
          setMeasurementComment(text);
          setCommentModalVisible(false);
        }}
        onCancel={() => setCommentModalVisible(false)}
      />
    </View>
  );
}
