import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { getMeasurementLocation } from "~/shared/location/measurement-location";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/measurements/measurement-annotations";
import {
  getMeasurementMqttTopic,
  QUESTIONS_PROTOCOL_ID,
} from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";
import { whenDeviceIdentityLoaded } from "~/shared/stores/device-identity-store";

import type { ExperimentAnnotationFlagType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

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
      workbookRunId,
      workbookVersionId,
    }: {
      timestamp: string;
      timezone: string;
      experimentName: string;
      experimentId: string;
      userId: string;
      questions: AnswerData[];
      commentText?: string;
      flagType?: ExperimentAnnotationFlagType | null;
      workbookRunId: string;
      workbookVersionId?: string;
    }) => {
      await whenDeviceIdentityLoaded();
      const topic = getMeasurementMqttTopic({ experimentId });

      const location = await getMeasurementLocation();

      const payload = {
        questions,
        macros: null,
        device_id: null,
        timestamp,
        timezone,
        user_id: userId,
        protocol_id: QUESTIONS_PROTOCOL_ID,
        workbook_run_id: workbookRunId,
        ...(workbookVersionId ? { workbook_version_id: workbookVersionId } : {}),
        annotations: buildAnnotations(commentText, flagType),
        ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
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
