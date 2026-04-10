import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { useMeasurements } from "~/hooks/use-measurements";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/utils/get-multispeq-mqtt-topic";
import { buildAnnotations } from "~/utils/measurement-annotations";

export function useQuestionsUpload() {
  const { saveMeasurement } = useMeasurements();

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
      flagType?: string | null;
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

      try {
        await sendMqttEvent(topic, payload);
        toast.success("Answers uploaded!");
        await saveMeasurement(failedUploadData, "successful");
        return;
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        toast.error("Upload not available, upload it later from Recent");
      }

      try {
        await saveMeasurement(failedUploadData, "failed");
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
