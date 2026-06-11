import { useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import type { ScanResult } from "~/features/measurement-flow/domain/flow-transitions";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { playSound } from "~/features/measurement-flow/utils/play-sound";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-capture");

// View-model for MeasurementNode: owns the scan lifecycle (preconditions +
// user feedback, execution, store wiring, disconnect cleanup) so the
// component is a pure render switch over the returned state.
export function useMeasurementCapture(content: { protocolId: string }) {
  const { t } = useTranslation("measurementFlow");
  const { protocol } = useProtocol(content.protocolId);
  const {
    executeScan,
    isScanning,
    reset: resetScan,
    result: scanResult,
    error: scanError,
    cancelCommand,
  } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep, setScanResult, setProtocolId, navigateToQuestionFromOverview } =
    useMeasurementFlowStore();
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);

  useEffect(() => {
    setProtocolId(content.protocolId);
  }, [setProtocolId, content.protocolId]);

  // Keep a stable ref to resetScan so the disconnect-cleanup effect below
  // doesn't need to list it as a dependency (avoids any memoisation concerns).
  const resetScanRef = useRef(resetScan);
  resetScanRef.current = resetScan;

  // When the device unexpectedly disconnects while a scan is in progress,
  // reset the scan so the user can reconnect and retry cleanly rather than
  // being stuck on the scanning screen.
  useEffect(() => {
    if (!device && isScanning) {
      resetScanRef.current();
    }
  }, [device, isScanning]);

  const startScan = async () => {
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
      log.error("scan error", { err: (error as Error)?.message });
      toast.error(t("measurementFlow:measurementNode.toast.scanError"));
    }
  };

  const cancelScan = () => {
    void cancelCommand();
    resetScan();
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
  };
}
