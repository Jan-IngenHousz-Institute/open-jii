import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { useMeasurements } from "~/hooks/use-measurements";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";
import { buildAnnotations } from "~/utils/measurement-annotations";

import type { AnnotationFlagType } from "@repo/api/schemas/experiment.schema";

export function useQuestionsUpload() {
  const { saveMeasurement, markUploaded, markFailed } = useMeasurements();

  const { loading: isUploading, execute: uploadQuestions } = useAsyncCallback(
    async ({
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
        toast.error(
          "Answers could not be saved on this device. Please export your data now to avoid losing it.",
        );
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
        toast.error("Upload not available, upload it later from Recent");
        return;
      }

      try {
        await markUploaded(savedId);
        toast.success("Answers uploaded!");
      } catch (localError) {
        console.error("Local status update failed after successful publish:", localError);
        toast.info("Uploaded — local status will refresh on next sync");
      }
    },
  );

  return { isUploading, uploadQuestions };
}
