import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { classifyScanError } from "~/features/connection/utils/classify-scan-error";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

const log = createLogger("measurement-capture");

// View-model for MeasurementNode over the workbook runner: the runner parks a
// producer cell behind the scan gate until the user taps Start; this hook owns
// the tap preconditions, error toasts, and disconnect cleanup.
export function useMeasurementCapture(content: MeasurementContent) {
  const { t } = useTranslation("measurementFlow");
  // Resolved once at flow-load (hydrateFlowNodes): snapshot code + cell name.
  const protocol = content.protocol;
  const { progress: scanProgress, scanStartedAt, estimatedMs } = useScannerCommandExecutor();
  const { data: device, refetch: refetchConnectedDevice } = useConnectedDevice();
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);
  const queryClient = useQueryClient();

  const cellId = useWorkbookFlowStore((s) => s.currentNode?.id);
  const runnerStatus = useWorkbookFlowStore((s) => s.runnerState?.status);
  const awaitingScanStart = useWorkbookFlowStore((s) => s.awaitingScanStart);
  const scanErrorRaw = useWorkbookFlowStore((s) => s.scanError);
  const cellErrorMessage = useWorkbookFlowStore((s) =>
    s.currentNode ? s.runnerState?.cellRuns[s.currentNode.id]?.error : undefined,
  );
  const openQuestionFromOverview = useWorkbookFlowStore((s) => s.openQuestionFromOverview);

  // Scanning = the runner is executing this producer and the gate is released.
  const isScanning = runnerStatus === "running" && !awaitingScanStart;
  const scanError =
    runnerStatus !== "pausedError"
      ? undefined
      : scanErrorRaw instanceof Error
        ? scanErrorRaw
        : cellErrorMessage !== undefined
          ? new Error(cellErrorMessage)
          : undefined;

  // Re-entry guard: the liveness probe is awaited before the runner flips to
  // running, so without this a double-tap could launch two scans.
  const isStartingRef = useRef(false);

  // When the device unexpectedly disconnects mid-scan, abort the in-flight
  // command so it settles as cancelled instead of a raw transport error.
  useEffect(() => {
    if (!device && isScanning) {
      useWorkbookFlowStore.getState().cancelScan();
    }
  }, [device, isScanning]);

  // Scan replies embed the battery level; patch the battery cache so
  // consumers stay fresh without re-firing the battery command.
  const scanResult = useWorkbookFlowStore((s) => s.scanResult);
  useEffect(() => {
    const pct = (scanResult as { device_battery?: unknown } | undefined)?.device_battery;
    const connected = queryClient.getQueryData<Device | null>(connectionKeys.connectedDevice);
    if (typeof pct === "number" && connected) {
      queryClient.setQueryData(connectionKeys.battery(connected.id), pct);
    }
  }, [scanResult, queryClient]);

  const startScan = async () => {
    if (isScanning || isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      if (!device) {
        toast.error(t("measurementFlow:measurementNode.toast.notConnected"));
        return;
      }
      if (!content.protocolId) {
        toast.error(t("measurementFlow:measurementNode.toast.noProtocol"));
        return;
      }
      if (!protocol) {
        toast.error(t("measurementFlow:measurementNode.toast.protocolUnavailable"));
        return;
      }

      // The cached `device` flag is polled (~3s) and lags a real drop; probe the
      // live connection first so we fail with a reconnect prompt, not a long hang.
      const { data: liveDevice } = await refetchConnectedDevice();
      if (!liveDevice) {
        log.warn("scan blocked: device not connected");
        toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
        return;
      }

      if (cellId) useWorkbookFlowStore.getState().startScan(cellId);
    } finally {
      isStartingRef.current = false;
    }
  };

  // Surface scan failures as toasts once, when the runner records them.
  // Cancellations never reach here (the runner settles them as cancelled).
  const toastedErrorRef = useRef<unknown>(undefined);
  useEffect(() => {
    if (scanErrorRaw === undefined || toastedErrorRef.current === scanErrorRaw) return;
    toastedErrorRef.current = scanErrorRaw;
    const kind = classifyScanError(scanErrorRaw);
    if (kind === "cancelled") return;
    if (kind === "disconnected") {
      log.error("scan error: device disconnected", { err: (scanErrorRaw as Error)?.message });
      toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
      return;
    }
    log.error("scan error", { err: (scanErrorRaw as Error)?.message });
    toast.error(t("measurementFlow:measurementNode.toast.scanError"));
  }, [scanErrorRaw, t]);

  const cancelScan = () => {
    useWorkbookFlowStore.getState().cancelScan();
  };

  return {
    device,
    protocol,
    isScanning,
    scanError,
    startScan,
    cancelScan,
    openDeviceSheet,
    navigateToQuestionFromOverview: openQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
  };
}
