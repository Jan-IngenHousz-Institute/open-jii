import { useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { classifyScanError } from "~/features/connection/utils/classify-scan-error";
import type { ScanResult } from "~/features/measurement-flow/domain/flow-transitions";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { playSound } from "~/features/measurement-flow/utils/play-sound";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-capture");

// View-model for MeasurementNode: owns the scan lifecycle (preconditions +
// user feedback, execution, store wiring, disconnect cleanup) so the
// component is a pure render switch over the returned state.
export function useMeasurementCapture(content: MeasurementContent) {
  const { t } = useTranslation("measurementFlow");
  // Resolved once at flow-load (hydrateFlowNodes): snapshot code + cell name.
  const protocol = content.protocol;
  const {
    executeScan,
    isScanning,
    reset: resetScan,
    result: scanResult,
    error: scanError,
    cancelCommand,
    progress: scanProgress,
    scanStartedAt,
    estimatedMs,
  } = useScanner();
  const { data: device, refetch: refetchConnectedDevice } = useConnectedDevice();
  const { nextStep, setScanResult, setProtocolId, navigateToQuestionFromOverview } =
    useMeasurementFlowStore();
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);

  useEffect(() => {
    setProtocolId(content.protocolId);
  }, [setProtocolId, content.protocolId]);

  // Keep stable refs so the disconnect-cleanup effect below doesn't need to
  // list these as dependencies (avoids any memoisation concerns).
  const resetScanRef = useRef(resetScan);
  resetScanRef.current = resetScan;
  const cancelCommandRef = useRef(cancelCommand);
  cancelCommandRef.current = cancelCommand;

  // Re-entry guard: the liveness probe is awaited before executeScan flips
  // isScanning, so without this a double-tap could launch two scans.
  const isStartingRef = useRef(false);

  // When the device unexpectedly disconnects mid-scan, abort the in-flight
  // command before resetting (resetting first surfaces a raw transport error
  // instead of the coherent cancelled path), then reset for a clean retry.
  useEffect(() => {
    if (!device && isScanning) {
      void (async () => {
        try {
          await cancelCommandRef.current();
        } finally {
          resetScanRef.current();
        }
      })();
    }
  }, [device, isScanning]);

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

      resetScan();
      try {
        const result = await executeScan(protocol);
        // executeScan types its payload as plain `object`; the device output
        // is JSON, so the structural ScanResult cast is safe at this seam.
        setScanResult(result as ScanResult | undefined);
        // Play system notification sound when measurement completes
        await playSound();
        nextStep();
      } catch (error) {
        const kind = classifyScanError(error);
        // Cancellation is user-initiated and handled by the cancel path.
        if (kind === "cancelled") {
          return;
        }
        if (kind === "disconnected") {
          log.error("scan error: device disconnected", { err: (error as Error)?.message });
          toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
          return;
        }
        log.error("scan error", { err: (error as Error)?.message });
        toast.error(t("measurementFlow:measurementNode.toast.scanError"));
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const cancelScan = () => {
    // Await the cancel before resetting so the command settles as
    // "Measurement cancelled", not a raw error the scan catch would misread.
    void (async () => {
      try {
        await cancelCommandRef.current();
      } finally {
        resetScanRef.current();
      }
    })();
  };

  return {
    device,
    protocol,
    isScanning,
    scanResult,
    scanError,
    startScan,
    cancelScan,
    openDeviceSheet,
    navigateToQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
  };
}
