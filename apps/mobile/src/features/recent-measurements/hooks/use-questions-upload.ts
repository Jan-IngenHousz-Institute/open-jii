import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";
import { createLogger } from "~/shared/observability/logger";

import type { AnnotationFlagType } from "@repo/api/schemas/experiment.schema";

const log = createLogger("questions-upload");

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
        log.error("Failed to save answers to local storage", {
          err: (storageError as Error)?.message,
        });
        toast.error(t("recentMeasurements:toasts.answersSaveFailed"));
        // Re-throw so the mutation rejects: a swallowed failure here would
        // resolve "successfully" and let the caller advance the flow as if
        // the answers were saved/enqueued when nothing was.
        throw storageError;
      }

      getOutbox().enqueue(savedId);
    },
  });

  return { isUploading: mutation.isPending, uploadQuestions: mutation.mutateAsync };
}
