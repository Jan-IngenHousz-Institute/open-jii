import { clsx } from "clsx";
import { Info } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { createLogger } from "~/shared/utils/logger";
import { playSound } from "~/shared/utils/play-sound";

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

  const handleCardPress = (flowStepIndex: number) => {
    navigateToQuestionFromOverview(flowStepIndex);
  };

  const handleCancelMeasurement = () => {
    void cancelCommand();
    resetScan();
  };

  const handleStartScan = async () => {
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
      setScanResult(result);
      // Play system notification sound when measurement completes
      await playSound();
      nextStep();
    } catch (error) {
      log.error("scan error", { err: (error as Error)?.message });
      toast.error(t("measurementFlow:measurementNode.toast.scanError"));
    }
  };

  const renderState = () => {
    if (!device) {
      return <NoDeviceState />;
    }

    if (scanError) {
      return (
        <View className="flex-1">
          <View className="flex-1 p-4">
            <ErrorState error={scanError} />
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

    if (isScanning || scanResult) {
      return (
        <View className="flex-1">
          <View className="flex-1 p-4">
            <ScanningState protocolName={protocol?.name} />
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
