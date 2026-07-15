import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { v4 as uuidv4 } from "uuid";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { buildUploadPayload } from "~/features/recent-measurements/services/build-upload-payload";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { getMultispeqMqttTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";
import { showAlert } from "~/shared/ui/AlertDialog";

const log = createLogger("measurement-upload");

type TFn = ReturnType<typeof useTranslation>["t"];

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
            log.error("Failed to export measurement to file", {
              err: (exportError as Error)?.message,
            });
            toast.error(t("recentMeasurements:alerts.saveToFileError"));
          });
        },
      },
      { text: t("common:dismiss"), variant: "ghost" },
    ],
  );
}

interface SharedUploadArgs {
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
}

export function useMeasurementUpload() {
  const { saveMeasurement } = useMeasurements();
  const { t } = useTranslation(["common", "recentMeasurements"]);

  const mutation = useMutation({
    // Save runs locally; the Outbox handles offline/online itself, so
    // there's no reason to pause the mutation off-network.
    networkMode: "always",
    mutationFn: async ({
      results,
      tagWorkbookRun,
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
    }: SharedUploadArgs & {
      results: { rawMeasurement: any; device?: { id: string; name: string } }[];
      tagWorkbookRun: boolean;
    }) => {
      // Reject malformed input instead of resolving as a no-op. `typeof
      // null === "object"` would otherwise slip a null through to
      // buildUploadPayload() and crash on `"sample" in null`, and a
      // silent success would let the flow advance with nothing saved.
      for (const { rawMeasurement } of results) {
        if (rawMeasurement === null || typeof rawMeasurement !== "object") {
          throw new Error(
            `Invalid rawMeasurement: expected object, got ${rawMeasurement === null ? "null" : typeof rawMeasurement}`,
          );
        }
      }
      if (results.length === 0) {
        throw new Error("No measurements to upload");
      }

      const topic = getMultispeqMqttTopic({ experimentId, protocolId });
      // One workbook_run_id per multi-scan round; each row is still its own
      // MQTT message in the ordinary envelope (see CONTEXT.md: Workbook run).
      const workbookRunId = tagWorkbookRun && results.length > 1 ? uuidv4() : undefined;

      const savedIds: string[] = [];
      let lastStorageError: unknown;

      for (const { rawMeasurement, device } of results) {
        const measurementData = buildUploadPayload({
          rawMeasurement,
          userId,
          macro,
          timestamp,
          timezone,
          questions,
          commentText,
          workbookRunId,
          fallbackDeviceId: device?.id,
        });

        const measurement = {
          topic,
          measurementResult: measurementData,
          metadata: { experimentName, protocolName, timestamp: measurementData.timestamp },
        };

        try {
          savedIds.push(await saveMeasurement(measurement, "pending"));
        } catch (storageError) {
          log.error("Failed to save measurement to local storage", {
            err: (storageError as Error)?.message,
          });
          lastStorageError = storageError;
          promptMeasurementFileSave(t, measurement);
          // Keep saving the remaining devices' measurements; one bad row
          // shouldn't discard the rest of the round.
        }
      }

      getOutbox().enqueueMany(savedIds);

      // Rethrow when nothing persisted so callers awaiting the upload can
      // distinguish a failed local save from success and avoid advancing the
      // flow with nothing saved.
      if (savedIds.length === 0) {
        throw lastStorageError instanceof Error
          ? lastStorageError
          : new Error("Failed to save measurements");
      }
    },
  });

  return {
    isUploading: mutation.isPending,
    uploadMeasurements: mutation.mutateAsync,
    uploadMeasurement: (args: SharedUploadArgs & { rawMeasurement: any }) => {
      const { rawMeasurement, ...shared } = args;
      return mutation.mutateAsync({
        ...shared,
        results: [{ rawMeasurement }],
        tagWorkbookRun: false,
      });
    },
  };
}
