import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { getUploadQueue } from "~/features/recent-measurements/services/upload-queue";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

import type { AnnotationFlagType } from "@repo/api/schemas/experiment.schema";

export function useQuestionsUpload() {
  const { saveMeasurement } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    networkMode: "always",
    mutationFn: async ({
      timestamp,
      timezone,
      experimentName,
      experimentId,
      userId,
      questions,
      commentText,
      flagType,
    }: {
      timestamp: string;
      timezone: string;
      experimentName: string;
      experimentId: string;
      userId: string;
      questions: AnswerData[];
      commentText?: string;
      flagType?: AnnotationFlagType | null;
    }) => {
      const topic = getMultispeqMqttTopic({ experimentId, protocolId: "questions" });

      const payload = {
        questions,
        macros: null,
        device_id: null,
        timestamp,
        timezone,
        user_id: userId,
        annotations: buildAnnotations(commentText, flagType),
      };

      const measurement = {
        topic,
        measurementResult: payload,
        metadata: { experimentName, protocolName: "questions", timestamp },
      };

      let savedId: string;
      try {
        savedId = await saveMeasurement(measurement, "pending");
      } catch (storageError) {
        console.error("Failed to save answers to local storage:", storageError);
        toast.error(t("recentMeasurements:toasts.answersSaveFailed"));
        return;
      }

      getUploadQueue().enqueue(savedId);
      toast.info(t("recentMeasurements:toasts.savedQueued"));
    },
  });

  return { isUploading: mutation.isPending, uploadQuestions: mutation.mutateAsync };
}
