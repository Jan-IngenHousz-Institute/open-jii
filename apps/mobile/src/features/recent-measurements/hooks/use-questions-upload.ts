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
  const { saveMeasurement, claimForUpload, markUploaded, markFailed } = useMeasurements();
  const networkState = useNetworkState();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    // The mutationFn handles offline internally (saves locally, bails before
    // MQTT). React Query's default `networkMode: "online"` would pause the
    // mutation when the device is offline and never call mutationFn — leaving
    // the UI stuck on "Uploading…" with no save and no log output.
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
      console.log("[questions-upload] start", {
        hasComment: Boolean(commentText),
        flagType,
      });

      try {
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
          console.log("[questions-upload] saveMeasurement: start");
          savedId = await saveMeasurement(failedUploadData, "pending");
          console.log("[questions-upload] saveMeasurement: done", { savedId });
        } catch (storageError) {
          console.error("Failed to save answers to local storage:", storageError);
          toast.error(t("recentMeasurements:toasts.answersSaveFailed"));
          return;
        }

        // See use-measurement-upload.ts — when offline, leave the row pending
        // rather than letting Cognito's credential fetch throw and trip the
        // "failed" path. useAutoUpload retries pending rows on reconnect.
        console.log("[questions-upload] networkState", {
          isInternetReachable: networkState.isInternetReachable,
        });
        // Treat anything other than confirmed-online as offline. expo-network
        // can briefly return null/undefined during boot or connectivity changes,
        // and falling through to MQTT in that window leaves the user staring at
        // "Uploading…" for the full connect timeout while paho fails to connect.
        // useAutoUpload's network-restore listener picks the row up on reconnect.
        if (networkState.isInternetReachable !== true) {
          toast.info(t("recentMeasurements:toasts.savedOffline"));
          return;
        }

        // Claim the row before publishing so useAutoUpload's parallel
        // uploadAll (kicked off by the saveMeasurement invalidation) can't
        // pick the same row and double-publish to MQTT.
        const claimed = await claimForUpload([savedId]);
        if (claimed.length === 0) {
          console.log("[questions-upload] row already claimed by parallel upload — skipping");
          return;
        }

        // See use-measurement-upload.ts — split publish from local-state update
        // so a successful publish followed by a markUploaded error doesn't
        // incorrectly flip the row to failed.
        try {
          console.log("[questions-upload] sendMqttEvent: start");
          await sendMqttEvent(topic, payload);
          console.log("[questions-upload] sendMqttEvent: done");
        } catch (uploadError) {
          console.error("Upload failed:", uploadError);
          await markFailed(savedId);
          toast.error(t("recentMeasurements:toasts.uploadNotAvailable"));
          return;
        }

        try {
          console.log("[questions-upload] markUploaded: start");
          await markUploaded(savedId);
          console.log("[questions-upload] markUploaded: done");
          toast.success(t("recentMeasurements:toasts.answersUploaded"));
        } catch (localError) {
          console.error("Local status update failed after successful publish:", localError);
          toast.info(t("recentMeasurements:toasts.uploadedLocalStatusRefresh"));
        }
      } finally {
        console.log("[questions-upload] mutationFn: exit");
      }
    },
  });

  return { isUploading: mutation.isPending, uploadQuestions: mutation.mutateAsync };
}
