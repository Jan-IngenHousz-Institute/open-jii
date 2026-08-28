import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { buildUploadPayload } from "~/features/recent-measurements/services/build-upload-payload";
import { exportSingleMeasurementToFile } from "~/features/recent-measurements/services/export-measurements";
import { getOutbox } from "~/shared/composition/upload";
import { useTranslation } from "~/shared/i18n";
import { getMeasurementLocation } from "~/shared/location/measurement-location";
import { getClientMetadata } from "~/shared/measurements/client-metadata";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { getMeasurementMqttTopic } from "~/shared/measurements/measurement-topic";
import { createLogger } from "~/shared/observability/logger";
import { whenDeviceIdentityLoaded } from "~/shared/stores/device-identity-store";
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
  workbookVersionId: string;
  /** The workbook that version belongs to; stored so re-runs survive re-linking. */
  workbookId?: string;
  /** Stable UUID for the complete workbook attempt, across sequential nodes. */
  workbookRunId: string;
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
      workbookVersionId,
      workbookId,
      workbookRunId,
    }: SharedUploadArgs & {
      results: {
        rawMeasurement: any;
        device?: { id: string; name: string; family?: string; firmwareVersion?: string };
        // Dispatch rounds: the protocol this device actually ran; overrides
        // the batch-level protocolId/protocolName for this result only.
        protocolId?: string;
        protocolName?: string;
        macroContext?: Record<string, unknown>;
      }[];
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

      // Topics carry the phone's thing name; await rehydration structurally
      // rather than relying on upload always happening late in the session.
      await whenDeviceIdentityLoaded();

      // One fix per round: all devices measured at the same physical spot.
      const location = await getMeasurementLocation();

      const savedIds: string[] = [];
      let lastStorageError: unknown;

      for (const result of results) {
        const { rawMeasurement, device, macroContext } = result;
        const topic = getMeasurementMqttTopic({ experimentId });
        const measurementData = buildUploadPayload({
          rawMeasurement,
          userId,
          protocolId: result.protocolId ?? protocolId,
          macro,
          timestamp,
          timezone,
          questions,
          commentText,
          workbookRunId,
          workbookVersionId,
          workbookId,
          macroContext,
          fallbackDeviceId: device?.id,
          fallbackDeviceFamily: device?.family,
          fallbackDeviceFirmware: device?.firmwareVersion,
          location,
          client: getClientMetadata(),
        });

        const measurement = {
          topic,
          measurementResult: measurementData,
          metadata: {
            experimentName,
            protocolName: result.protocolName ?? protocolName,
            timestamp: measurementData.timestamp,
          },
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
      });
    },
  };
}
