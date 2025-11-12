import { clsx } from "clsx";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { Button } from "~/components/Button";
import { useProtocol } from "~/hooks/use-protocol";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { useScanner } from "~/services/scan-manager/scan-manager";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { playSound } from "~/utils/play-sound";

import { ErrorState } from "./components/error-state";
import { NoDeviceState } from "./components/no-device-state";
import { ReadyState } from "./components/ready-state";
import { ScanningState } from "./components/scanning-state";

interface MeasurementNodeProps {
  content: {
    params: Record<string, unknown>;
    protocolId: string;
  };
}

export function MeasurementNode({ content }: MeasurementNodeProps) {
  const { classes } = useTheme();
  const { protocol } = useProtocol(content.protocolId);
  const {
    executeScan,
    isScanning,
    reset: resetScan,
    result: scanResult,
    error: scanError,
  } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep, setScanResult, setProtocolId } = useMeasurementFlowStore();

  useEffect(() => {
    setProtocolId(content.protocolId);
  }, [setProtocolId, content.protocolId]);

  const handleStartScan = async () => {
    if (!device) {
      toast.error("Not connected to sensor");
      return;
    }
    if (!content.protocolId) {
      toast.error("No protocol selected");
      return;
    }

    resetScan();
    try {
      // For measurement node, we only execute the protocol scan, no macro
      const result = await executeScan(content.protocolId);
      setScanResult(result);
      // Play system notification sound when measurement completes
      await playSound();
      nextStep();
    } catch (error) {
      console.log("scan error", error);
      showToast("Scan error", "error");
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
          <View className="border-t border-gray-200 p-4 dark:border-gray-700">
            <Button
              title="Retry"
              onPress={handleStartScan}
              variant="outline"
              style={{ width: "100%" }}
              textStyle={{ color: "#ef4444" }}
            />
          </View>
        </View>
      );
    }

    if (isScanning) {
      return (
        <View className="flex-1">
          <View className="flex-1 p-4">
            <ScanningState scanResult={scanResult} />
          </View>
          <View className="border-t border-gray-200 p-4 dark:border-gray-700">
            <Button
              title="Cancel Measurement"
              onPress={resetScan}
              variant="outline"
              style={{ width: "100%" }}
              textStyle={{ color: "#ef4444" }}
            />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <View className="flex-1 items-center justify-center p-4">
          <ReadyState protocol={protocol} />
        </View>
        <View className="border-t border-gray-200 p-4 dark:border-gray-700">
          <Button title="Measure" onPress={handleStartScan} style={{ width: "100%" }} />
        </View>
      </View>
    );
  };

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Measurement</Text>
        {protocol && (
          <Text className={clsx("text-sm", classes.textSecondary)}>Protocol: {protocol.name}</Text>
        )}
      </View>

      <View className="flex-1">{renderState()}</View>
    </View>
  );
}
