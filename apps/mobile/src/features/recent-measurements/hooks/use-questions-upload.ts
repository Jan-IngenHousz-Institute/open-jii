import { useMutation } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { toast } from "sonner-native";
import { sendMqttEvent } from "~/features/connection/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

import type { AnnotationFlagType } from "@repo/api/schemas/experiment.schema";

export function useQuestionsUpload() {
  const { saveMeasurement, markUploaded, markFailed } = useMeasurements();
  const networkState = useNetworkState();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
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

      const failedUploadData = {
        topic,
        measurementResult: payload,
        metadata: {
          experimentName,
          protocolName: "questions",
          timestamp,
        },
      };

      // Persist before attempting MQTT (see use-measurement-upload.ts).
      let savedId: string;
      try {
        savedId = await saveMeasurement(failedUploadData, "pending");
      } catch (storageError) {
        console.error("Failed to save answers to local storage:", storageError);
        toast.error(t("recentMeasurements:toasts.answersSaveFailed"));
        return;
      }

      // See use-measurement-upload.ts — when offline, leave the row pending
      // rather than letting Cognito's credential fetch throw and trip the
      // "failed" path. useAutoUpload retries pending rows on reconnect.
      if (networkState.isInternetReachable === false) {
        toast.info(t("recentMeasurements:toasts.savedOffline"));
        return;
      }

      // See use-measurement-upload.ts — split publish from local-state update
      // so a successful publish followed by a markUploaded error doesn't
      // incorrectly flip the row to failed.
      try {
        await sendMqttEvent(topic, payload);
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        await markFailed(savedId);
        toast.error(t("recentMeasurements:toasts.uploadNotAvailable"));
        return;
      }

      try {
        await markUploaded(savedId);
        toast.success(t("recentMeasurements:toasts.answersUploaded"));
      } catch (localError) {
        console.error("Local status update failed after successful publish:", localError);
        toast.info(t("recentMeasurements:toasts.uploadedLocalStatusRefresh"));
      }
    },
  });

  return { isUploading: mutation.isPending, uploadQuestions: mutation.mutateAsync };
}
