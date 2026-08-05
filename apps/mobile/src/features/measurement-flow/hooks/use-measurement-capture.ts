import { useMemo, useRef } from "react";
import { toast } from "sonner-native";
import { useConnectedDevices } from "~/features/connection/hooks/use-device-connection";
import type { DeviceScanState } from "~/features/connection/hooks/use-multi-scanner";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";

/** Runner-backed view model for the measurement card and its user scan gate. */
export function useMeasurementCapture(content: MeasurementContent, nodeId?: string) {
  const { t } = useTranslation("measurementFlow");
  const { data: devices = [], refetch: refetchConnectedDevices } = useConnectedDevices();
  const executors = useScannerCommandExecutorStore((state) => state.executors);
  const scanProgress = useScannerCommandExecutorStore((state) => state.progress);
  const scanStartedAt = useScannerCommandExecutorStore((state) => state.scanStartedAt);
  const estimatedMs = useScannerCommandExecutorStore((state) => state.estimatedMs);
  const {
    runnerState,
    awaitingScanStart,
    runnerScanRound,
    runnerSucceededCount,
    startRunnerScan,
    continueRunnerWithSuccesses,
    cancelRunnerScan,
    navigateToQuestionFromOverview,
  } = useMeasurementFlowStore();
  const openDeviceSheet = useDeviceSheetStore((state) => state.open);
  const isStartingRef = useRef(false);

  const deviceStates = useMemo<DeviceScanState[]>(
    () =>
      Array.from(executors.values(), (entry) => ({
        device: entry.device,
        identity: entry.identity,
        status: entry.isExecuting
          ? "scanning"
          : entry.error
            ? "error"
            : entry.commandResponse
              ? "done"
              : "idle",
        error: entry.error,
      })),
    [executors],
  );

  const startScan = async () => {
    if (isStartingRef.current || (runnerState?.status === "running" && !awaitingScanStart)) return;
    isStartingRef.current = true;
    try {
      if (devices.length === 0) {
        toast.error(t("measurementFlow:measurementNode.toast.notConnected"));
        return;
      }
      if (!content.command) {
        if (!content.protocolId) {
          toast.error(t("measurementFlow:measurementNode.toast.noProtocol"));
          return;
        }
        if (!content.protocol) {
          toast.error(t("measurementFlow:measurementNode.toast.protocolUnavailable"));
          return;
        }
      }
      const { data: liveDevices } = await refetchConnectedDevices();
      if (!liveDevices || liveDevices.length === 0) {
        toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
        return;
      }
      if (nodeId) startRunnerScan(nodeId);
    } finally {
      isStartingRef.current = false;
    }
  };

  return {
    device: devices[0] ?? null,
    devices,
    protocol: content.protocol,
    isScanning: runnerState?.status === "running" && !awaitingScanStart,
    deviceStates,
    lastRound: runnerScanRound,
    succeededCount: runnerSucceededCount,
    startScan,
    cancelScan: cancelRunnerScan,
    completeWithSuccesses: continueRunnerWithSuccesses,
    openDeviceSheet,
    navigateToQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
  };
}
