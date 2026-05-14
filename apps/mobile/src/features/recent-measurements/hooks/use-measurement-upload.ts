import { useNetworkState } from "expo-network";
import { useAsyncCallback } from "react-async-hook";
import { toast } from "sonner-native";
import { sendMqttEvent } from "~/features/connection/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { showAlert } from "~/shared/ui/AlertDialog";
import { compressSample } from "~/shared/utils/compress-sample";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

interface MacroInfo {
  id: string;
  name: string;
  filename: string;
}

interface PrepareMeasurementArgs {
  rawMeasurement: any;
  userId: string;
  macro: MacroInfo | null;
  timestamp: string;
  timezone: string;
  questions: AnswerData[];
  commentText?: string;
}

function prepareMeasurementForUpload({
  rawMeasurement,
  userId,
  macro,
  timestamp,
  timezone,
  questions,
  commentText,
}: PrepareMeasurementArgs) {
  if ("sample" in rawMeasurement && rawMeasurement.sample) {
    const samples = Array.isArray(rawMeasurement.sample)
      ? rawMeasurement.sample
      : [rawMeasurement.sample];

    for (const sample of samples) {
      sample.macros = macro?.filename ? [macro.filename] : [];
    }
  }

  const macros: MacroInfo[] = macro ? [macro] : [];
  const annotations = buildAnnotations(commentText);

  const payload = {
    questions,
    macros,
    timestamp,
    timezone,
    user_id: userId,
    ...rawMeasurement,
    annotations,
  };

  // Compress the (large) sample field to reduce MQTT payload size.
  // The outer JSON envelope stays valid for AWS IoT Core SQL parsing.
  if (payload.sample != null) {
    payload.sample = compressSample(payload.sample);
    payload._sample_encoding = "gzip+base64";
  }

  return payload;
}

function promptMeasurementFileSave(measurement: {
  topic: string;
  measurementResult: object;
  metadata: { experimentName: string; protocolName: string; timestamp: string };
}) {
  showAlert(
    "Something went wrong",
    "Could not save the measurement. Would you like to save it as a file instead?",
    [
      {
        text: "Save to File",
        variant: "primary",
        onPress: () => {
          exportSingleMeasurementToFile(measurement).catch((exportError) => {
            console.error("Failed to export measurement to file:", exportError);
            toast.error("Could not save measurement. Please try again.");
          });
        },
      },
      { text: "Dismiss", variant: "ghost" },
    ],
  );
}

export function useMeasurementUpload() {
  const { saveMeasurement, markUploaded, markFailed } = useMeasurements();
  const networkState = useNetworkState();

  const { loading: isUploading, execute: uploadMeasurement } = useAsyncCallback(
    async ({
      rawMeasurement,
      timestamp,
      timezone,
      experimentName,
      experimentId,
      protocolId,
      protocolName,
      userId,
      macro,
      questions,
      commentText,
    }: {
      rawMeasurement: any;
      timestamp: string;
      timezone: string;
      experimentName: string;
      experimentId: string;
      protocolId: string;
      protocolName: string;
      userId: string;
      macro: { id: string; name: string; filename: string } | null;
      questions: AnswerData[];
      commentText?: string;
    }) => {
      if (typeof rawMeasurement !== "object") {
        return;
      }

      const measurementData = prepareMeasurementForUpload({
        rawMeasurement,
        userId,
        macro,
        timestamp,
        timezone,
        questions,
        commentText,
      });

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });

      const failedUploadData = {
        topic,
        measurementResult: measurementData,
        metadata: {
          experimentName,
          protocolName,
          timestamp: measurementData.timestamp,
        },
      };

      // Save locally first so the measurement appears in Recent immediately
      // and can be flagged on-device, regardless of upload outcome. Status
      // starts as "pending" — only flipped to "failed" once an actual MQTT
      // attempt errors out, so field metrics distinguish never-tried from
      // genuinely-failed rows.
      let savedId: string;
      try {
        savedId = await saveMeasurement(failedUploadData, "pending");
      } catch (storageError) {
        console.error("Failed to save measurement to local storage:", storageError);
        promptMeasurementFileSave(failedUploadData);
        return;
      }

      // If the device is offline, skip the publish entirely. Cognito's
      // credential fetch inside sendMqttEvent would throw and we'd mark the
      // row "failed" — but the schema reserves "failed" for rows that
      // actually attempted a publish. Leaving it "pending" lets
      // useAutoUpload's network-restore listener pick it up on reconnect.
      if (networkState.isInternetReachable === false) {
        toast.info("Saved offline — will upload when you're back online");
        return;
      }

      // Split into two phases: a publish failure means the data didn't reach
      // the cloud (mark failed, surface error). A local-state update failure
      // *after* a successful publish must not flip the row back to failed —
      // the data is already on the cloud; only log/toast the local issue.
      try {
        await sendMqttEvent(topic, measurementData);
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        await markFailed(savedId);
        toast.error("Upload not available, upload it later from Recent");
        return;
      }

      try {
        await markUploaded(savedId);
        toast.success("Measurement uploaded!");
      } catch (localError) {
        console.error("Local status update failed after successful publish:", localError);
        toast.info("Uploaded — local status will refresh on next sync");
      }
    },
  );

  return { isUploading, uploadMeasurement };
}
