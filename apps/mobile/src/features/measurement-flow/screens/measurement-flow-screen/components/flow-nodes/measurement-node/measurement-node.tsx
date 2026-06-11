import { clsx } from "clsx";
import { Info } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { useConnectedDevices } from "~/features/connection/hooks/use-device-connection";
import { useMultiScanner } from "~/features/connection/hooks/use-multi-scanner";
import type { DeviceScanResult } from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { playSound } from "~/features/measurement-flow/utils/play-sound";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { DeviceScanProgressList } from "./components/device-scan-progress-list";
import { ErrorState } from "./components/error-state";
import { NoDeviceState } from "./components/no-device-state";
import { ReadyState } from "./components/ready-state";
import { ScanningState } from "./components/scanning-state";

const log = createLogger("measurement-node");

interface MeasurementNodeProps {
  content: {
    params: Record<string, unknown>;
    protocolId: string;
  };
}

export function MeasurementNode({ content }: MeasurementNodeProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { protocol } = useProtocol(content.protocolId);
  const {
    executeScanAll,
    isScanning,
    lastRound,
    deviceStates,
    reset: resetScan,
    cancelAll,
  } = useMultiScanner();
  const { data: devices = [] } = useConnectedDevices();
  const { nextStep, setScanResults, setProtocolId, navigateToQuestionFromOverview } =
    useMeasurementFlowStore();
  const openDeviceSheet = useDeviceSheetStore((s) => s.open);
  useEffect(() => {
    setProtocolId(content.protocolId);
  }, [setProtocolId, content.protocolId]);

  // Successes accumulated across retry rounds of one Multi-scan: a device
  // that already returned a result is not re-scanned when the user retries
  // the failed ones.
  const successesRef = useRef<DeviceScanResult[]>([]);

  // Keep a stable ref to resetScan so the disconnect-cleanup effect below
  // doesn't need to list it as a dependency (avoids any memoisation concerns).
  const resetScanRef = useRef(resetScan);
  resetScanRef.current = resetScan;

  // When every device unexpectedly disconnects while a scan is in progress,
  // reset the scan so the user can reconnect and retry cleanly rather than
  // being stuck on the scanning screen.
  useEffect(() => {
    if (devices.length === 0 && isScanning) {
      successesRef.current = [];
      resetScanRef.current();
    }
  }, [devices.length, isScanning]);

  const handleCardPress = (flowStepIndex: number) => {
    navigateToQuestionFromOverview(flowStepIndex);
  };

  const handleCancelMeasurement = () => {
    void cancelAll();
    successesRef.current = [];
    resetScan();
  };

  const completeWithSuccesses = async () => {
    // Order results by connect order so device_index is stable for upload.
    const orderOf = (id: string) => {
      const i = devices.findIndex((d) => d.id === id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const ordered = [...successesRef.current].sort(
      (a, b) => orderOf(a.device.id) - orderOf(b.device.id),
    );
    successesRef.current = [];
    setScanResults(ordered);
    // Play system notification sound when measurement completes
    await playSound();
    nextStep();
  };

  const handleStartScan = async () => {
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

    // Only scan devices that haven't succeeded in a previous round.
    const pendingDevices = devices.filter(
      (d) => !successesRef.current.some((s) => s.device.id === d.id),
    );
    if (pendingDevices.length === 0) {
      await completeWithSuccesses();
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
        toast.error(t("measurementFlow:measurementNode.toast.scanError"));
        return;
      }
      if (round.failures.length === 0) {
        await completeWithSuccesses();
      }
      // Mixed round: the partial-failure state below offers continue/retry.
    } catch (error) {
      log.error("scan error", { err: (error as Error)?.message });
      toast.error(t("measurementFlow:measurementNode.toast.scanError"));
    }
  };

  const renderState = () => {
    if (devices.length === 0) {
      return <NoDeviceState />;
    }

    if (!isScanning && lastRound && lastRound.failures.length > 0) {
      const succeededCount = successesRef.current.length;

      // Every device failed: keep the classic full error state.
      if (succeededCount === 0) {
        return (
          <View className="flex-1">
            <View className="flex-1 p-4">
              <ErrorState error={lastRound.failures[0].error} />
            </View>
            <View className="flex-row gap-4 px-4 py-3">
              <Button
                title={t("measurementFlow:measurementNode.retryMeasurement")}
                onPress={handleStartScan}
                variant="tertiary"
                style={{ flex: 1, height: 44, borderColor: "transparent" }}
              />
              <Button
                title={t("measurementFlow:measurementNode.connectToDevice")}
                onPress={openDeviceSheet}
                style={{ height: 44, flex: 1 }}
              />
            </View>
          </View>
        );
      }

      // Partial failure: some devices have a measurement, some don't.
      return (
        <View className="flex-1">
          <View className="flex-1 gap-3 p-4">
            <Text className={clsx("text-center text-lg font-bold", classes.text)}>
              {t("measurementFlow:measurementNode.multiScan.partialTitle", {
                failed: lastRound.failures.length,
                total: lastRound.failures.length + succeededCount,
              })}
            </Text>
            <DeviceScanProgressList deviceStates={deviceStates} />
          </View>
          <View className="flex-row gap-4 px-4 py-3">
            <Button
              title={t("measurementFlow:measurementNode.multiScan.retryFailed")}
              onPress={handleStartScan}
              variant="tertiary"
              style={{ flex: 1, height: 44, borderColor: "transparent" }}
            />
            <Button
              title={t("measurementFlow:measurementNode.multiScan.continueWithSuccessful", {
                count: succeededCount,
              })}
              onPress={() => void completeWithSuccesses()}
              style={{ height: 44, flex: 1 }}
            />
          </View>
        </View>
      );
    }

    if (isScanning || lastRound) {
      return (
        <View className="flex-1">
          <View className="flex-1 p-4">
            <ScanningState protocolName={protocol?.name} deviceStates={deviceStates} />
          </View>
          <View className="gap-4 px-4 py-3">
            <View className="bg-muted flex-row items-center gap-2 rounded-lg p-2">
              <Info size={16} color={colors.brand} />
              <Text className={clsx("flex-1 text-sm leading-relaxed", classes.textMuted)}>
                {t("measurementFlow:measurementNode.privacyNote")}
              </Text>
            </View>

            <Button
              title={t("measurementFlow:measurementNode.cancelMeasurement")}
              onPress={handleCancelMeasurement}
              style={{ height: 44 }}
            />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <ReadyState onCardPress={handleCardPress} />
        <View className="px-4 py-3">
          <Button
            title={t("measurementFlow:measurementNode.startMeasurement")}
            onPress={handleStartScan}
            style={{ height: 44 }}
          />
        </View>
      </View>
    );
  };

  return <View className="flex-1 rounded-xl">{renderState()}</View>;
}
