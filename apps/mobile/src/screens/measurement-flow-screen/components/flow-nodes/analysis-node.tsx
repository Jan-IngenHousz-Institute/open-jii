import { clsx } from "clsx";
import { CircleCheckBig, ChevronUp } from "lucide-react-native";
import { DateTime } from "luxon";
import React, { useCallback, useRef, useState } from "react";
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

  // Local time with offset (plant timezone) for display and backend
  const analysisTimestampRef = useRef<string>(DateTime.now().toISO() ?? "");
  const { getCycleAnswers } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);

  const { isUploading, uploadMeasurement } = useMeasurementUpload();
  const { protocol } = useProtocol(protocolId);

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);
  const localDate = DateTime.fromISO(analysisTimestampRef.current).toFormat("d MMMM yyyy, HH:mm");

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

    await uploadMeasurement({
      rawMeasurement: scanResult,
      timestamp: analysisTimestampRef.current,
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
          <Text className={clsx(classes.text)}>
            <Text className="font-semibold">Experiment: </Text>
            <Text className={clsx(classes.textMuted)}>{experimentName}</Text>
          </Text>
          <Text className={clsx(classes.text)}>
            <Text className="font-semibold">Protocol: </Text>
            <Text className={clsx(classes.textMuted)}>{protocol?.name ?? "—"}</Text>
          </Text>
          <Text className={clsx(classes.text)}>
            <Text className="font-semibold">Answers: </Text>
            <Text className={clsx(classes.textMuted)}>
              {questions.length === 0
                ? "None"
                : questions.map((q) => q.question_answer).join(" | ")}
            </Text>
          </Text>
          <Text className={clsx(classes.text)}>
            <Text className="font-semibold">Date: </Text>
            <Text className={clsx(classes.textMuted)}>{localDate}</Text>
          </Text>
        </View>

        <View>{renderContent()}</View>
      </ScrollView>

      {hasScrolled ? (
        <View className="w-full items-start bg-white">
          <TouchableOpacity
            onPress={scrollToTop}
            className="flex-row gap-1 py-4"
            activeOpacity={0.7}
          >
            <ChevronUp size={18} color={colors.onSurface} />
            <Text className={clsx("text-md font-medium", classes.text)}>Scroll to top</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row gap-4 py-3">
          <Button
            title="Discard & Retry"
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
        onSave={(text) => {
          setMeasurementComment(text);
          setCommentModalVisible(false);
        }}
        onCancel={() => setCommentModalVisible(false)}
      />
    </View>
  );
}
