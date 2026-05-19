import { useMutation } from "@tanstack/react-query";
import { useNetworkState } from "expo-network";
import { toast } from "sonner-native";
import { sendMqttEvent } from "~/features/connection/services/mqtt/send-mqtt-event";
import { getMultispeqMqttTopic } from "~/features/connection/utils/get-multispeq-mqtt-topic";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { useTranslation } from "~/shared/i18n";
import { showAlert } from "~/shared/ui/AlertDialog";
import { compressSample } from "~/shared/utils/compress-sample";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";
import { buildAnnotations } from "~/shared/utils/measurement-annotations";

type TFn = ReturnType<typeof useTranslation>["t"];

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

function promptMeasurementFileSave(
  t: TFn,
  measurement: {
    topic: string;
    measurementResult: object;
    metadata: { experimentName: string; protocolName: string; timestamp: string };
  },
) {
  showAlert(
    t("recentMeasurements:alerts.saveErrorTitle"),
    t("recentMeasurements:alerts.saveErrorMessage"),
    [
      {
        text: t("recentMeasurements:alerts.saveToFileButton"),
        variant: "primary",
        onPress: () => {
          exportSingleMeasurementToFile(measurement).catch((exportError) => {
            console.error("Failed to export measurement to file:", exportError);
            toast.error(t("recentMeasurements:alerts.saveToFileError"));
          });
        },
      },
      { text: t("common:dismiss"), variant: "ghost" },
    ],
  );
}

export function useMeasurementUpload() {
  const { saveMeasurement, claimForUpload, markUploaded, markFailed } = useMeasurements();
  const networkState = useNetworkState();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    // mutationFn handles offline internally (saves locally, bails before MQTT).
    // Default `networkMode: "online"` would pause the mutation while offline
    // and never run mutationFn — the user would see "Uploading…" forever.
    networkMode: "always",
    mutationFn: async ({
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
        promptMeasurementFileSave(t, failedUploadData);
        return;
      }

      // If the device is offline, skip the publish entirely. Cognito's
      // credential fetch inside sendMqttEvent would throw and we'd mark the
      // row "failed" — but the schema reserves "failed" for rows that
      // actually attempted a publish. Leaving it "pending" lets
      // useAutoUpload's network-restore listener pick it up on reconnect.
      // `!== true` also catches the brief null/undefined window expo-network
      // exposes around connectivity transitions — otherwise we'd fall through
      // to MQTT and freeze the UI on the full connect timeout.
      if (networkState.isInternetReachable !== true) {
        toast.info(t("recentMeasurements:toasts.savedOffline"));
        return;
      }

      // Claim the row before publishing — otherwise useAutoUpload's parallel
      // uploadAll (triggered by the saveMeasurement query invalidation) can
      // grab the same "pending" row and double-publish.
      const claimed = await claimForUpload([savedId]);
      if (claimed.length === 0) {
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
        toast.error(t("recentMeasurements:toasts.uploadNotAvailable"));
        return;
      }

      try {
        await markUploaded(savedId);
        toast.success(t("recentMeasurements:toasts.measurementUploaded"));
      } catch (localError) {
        console.error("Local status update failed after successful publish:", localError);
        toast.info(t("recentMeasurements:toasts.uploadedLocalStatusRefresh"));
      }
    },
  });

  return { isUploading: mutation.isPending, uploadMeasurement: mutation.mutateAsync };
}
