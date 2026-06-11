import { useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { useConnectedDevices } from "~/features/connection/hooks/use-device-connection";
import { useMultiScanner } from "~/features/connection/hooks/use-multi-scanner";
import type { DeviceScanResult } from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { classifyScanError } from "~/features/connection/utils/classify-scan-error";
import type { ScanResult } from "~/features/measurement-flow/domain/flow-transitions";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { playSound } from "~/features/measurement-flow/utils/play-sound";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-capture");

// View-model for MeasurementNode: owns the multi-scan lifecycle so the
// component is a pure render switch over the returned state. nodeId (== cell
// id) attributes the recorded result to its producing cell. See CONTEXT.md.
export function useMeasurementCapture(content: MeasurementContent, nodeId?: string) {
  const { t } = useTranslation("measurementFlow");
  // Resolved once at flow-load (hydrateFlowNodes): snapshot code + cell name.
  const protocol = content.protocol;
  const {
    executeScanAll,
    isScanning,
    deviceStates,
    lastRound,
    reset: resetScan,
    cancelAll,
  } = useMultiScanner();
  const { data: devices = [], refetch: refetchConnectedDevices } = useConnectedDevices();
  const { nextStep, setScanResults, navigateToQuestionFromOverview } = useMeasurementFlowStore();
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);
  // Primary's live progress (legacy mirrors); the round shares one protocol so
  // the estimate applies to every device.
  const scanProgress = useScannerCommandExecutorStore((s) => s.progress);
  const scanStartedAt = useScannerCommandExecutorStore((s) => s.scanStartedAt);
  const estimatedMs = useScannerCommandExecutorStore((s) => s.estimatedMs);

  // Successes accumulated across retry rounds of one Multi-scan: a device
  // that already returned a result is not re-scanned when the user retries
  // the failed ones.
  const successesRef = useRef<DeviceScanResult[]>([]);

  // Keep stable refs so the disconnect-cleanup effect below doesn't need to
  // list these as dependencies (avoids any memoisation concerns).
  const resetScanRef = useRef(resetScan);
  resetScanRef.current = resetScan;
  const cancelAllRef = useRef(cancelAll);
  cancelAllRef.current = cancelAll;

  // Re-entry guard: the liveness probe is awaited before executeScanAll flips
  // isScanning, so without this a double-tap could launch two scans.
  const isStartingRef = useRef(false);

  // When every device unexpectedly disconnects mid-scan, abort the in-flight
  // commands before resetting (resetting first surfaces a raw transport error
  // instead of the coherent cancelled path), then reset for a clean retry.
  useEffect(() => {
    if (devices.length === 0 && isScanning) {
      successesRef.current = [];
      void (async () => {
        try {
          await cancelAllRef.current();
        } finally {
          resetScanRef.current();
        }
      })();
    }
  }, [devices.length, isScanning]);

  const completeWithSuccesses = () => {
    // Order results by connect order so device_index is stable for upload.
    const orderOf = (id: string) => {
      const i = devices.findIndex((d) => d.id === id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const ordered = [...successesRef.current].sort(
      (a, b) => orderOf(a.device.id) - orderOf(b.device.id),
    );
    successesRef.current = [];
    setScanResults(
      ordered.map(({ device, result }) => ({
        device: { id: device.id, name: device.name },
        result: result as ScanResult,
      })),
      nodeId,
    );
    // Single-node flows wrap nextStep() straight back to this same mounted
    // node; clear the finished round first so it renders Ready again instead
    // of a stale scanning screen with a dead Cancel button.
    resetScan();
    // Play system notification sound when measurement completes. Never block
    // flow advance on audio.
    playSound().catch((e) => log.warn("playSound failed", { err: (e as Error)?.message }));
    nextStep();
  };

  const startScan = async () => {
    if (isScanning || isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      if (devices.length === 0) {
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

      // The cached device list is polled (~3s) and lags a real drop; probe the
      // live connections first so we fail with a reconnect prompt, not a long hang.
      const { data: liveDevices } = await refetchConnectedDevices();
      if (!liveDevices || liveDevices.length === 0) {
        log.warn("scan blocked: no device connected");
        toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
        return;
      }

      // Only scan devices that haven't succeeded in a previous round.
      const pendingDevices = liveDevices.filter(
        (d) => !successesRef.current.some((s) => s.device.id === d.id),
      );
      if (pendingDevices.length === 0) {
        completeWithSuccesses();
        return;
      }

      try {
        const round = await executeScanAll(protocol, pendingDevices);
        successesRef.current = [
          ...successesRef.current.filter(
            (s) => !round.successes.some((r) => r.device.id === s.device.id),
          ),
          ...round.successes,
        ];

        if (round.failures.length > 0 && successesRef.current.length === 0) {
          const kind = classifyScanError(round.failures[0].error);
          // Cancellation is user-initiated and handled by the cancel path.
          if (kind === "cancelled") {
            return;
          }
          if (kind === "disconnected") {
            log.error("scan error: device disconnected", {
              err: round.failures[0].error.message,
            });
            toast.error(t("measurementFlow:measurementNode.toast.deviceDisconnected"));
            return;
          }
          log.error("scan error", { err: round.failures[0].error.message });
          toast.error(t("measurementFlow:measurementNode.toast.scanError"));
          return;
        }
        if (round.failures.length === 0) {
          completeWithSuccesses();
        }
        // Mixed round: the partial-failure state in MeasurementNode offers
        // continue-with-successful / retry-failed.
      } catch (error) {
        log.error("scan error", { err: (error as Error)?.message });
        toast.error(t("measurementFlow:measurementNode.toast.scanError"));
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const cancelScan = () => {
    successesRef.current = [];
    // Await the cancel before resetting so the commands settle as
    // "Measurement cancelled", not a raw error the scan catch would misread.
    void (async () => {
      try {
        await cancelAllRef.current();
      } finally {
        resetScanRef.current();
      }
    })();
  };

  return {
    device: devices[0] ?? null,
    devices,
    protocol,
    isScanning,
    deviceStates,
    lastRound,
    succeededCount: successesRef.current.length,
    startScan,
    cancelScan,
    completeWithSuccesses,
    openDeviceSheet,
    navigateToQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
  };
}
