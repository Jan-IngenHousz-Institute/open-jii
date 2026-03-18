import { useQueryClient } from "@tanstack/react-query";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { saveSuccessfulUpload } from "~/services/successful-uploads-storage";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";

export function useQuestionsUpload() {
  const queryClient = useQueryClient();
  const { saveFailedUpload } = useFailedUploads();

  const { loading: isUploading, execute: uploadQuestions } = useAsyncCallback(
    async ({
      timestamp,
      timezone,
      experimentName,
      experimentId,
      userId,
      questions,
    }: {
      timestamp: string;
      timezone: string;
      experimentName: string;
      experimentId: string;
      userId: string;
      questions: AnswerData[];
    }) => {
      const topic = getMultispeqMqttTopic({ experimentId, protocolId: "questions" });

      // NOTE: timestamp === normalized UTC timestamp. timezone is the IANA name (e.g. "Europe/Amsterdam").
      // Together they are the source of truth — all local-time representations are derived from these two.
      const payload = {
        questions,
        macros: null,
        device_id: null,
        timestamp,
        timezone,
        user_id: userId,
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

      try {
        await sendMqttEvent(topic, payload);
        toast.success("Answers uploaded!");
        await saveSuccessfulUpload(failedUploadData);
        await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
        return;
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        toast.error("Upload not available, upload it later from Recent");
      }

      try {
        await saveFailedUpload(failedUploadData);
        await queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
      } catch (storageError) {
        console.error("Failed to save answers to local storage:", storageError);
        toast.error(
          "Answers could not be saved on this device. Please export your data now to avoid losing it.",
        );
      }
    },
  );

  return { isUploading, uploadQuestions };
}
