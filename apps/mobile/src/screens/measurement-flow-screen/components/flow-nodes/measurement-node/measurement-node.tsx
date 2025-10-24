import { clsx } from "clsx";
import { useKeepAwake } from "expo-keep-awake";
import React from "react";
import { View, Text } from "react-native";
import { useToast } from "~/context/toast-context";
import { useProtocols } from "~/hooks/use-protocols";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { useScanner } from "~/services/scan-manager/scan-manager";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

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
  useKeepAwake();
  const { classes } = useTheme();
  const { protocols } = useProtocols();
  const {
    executeScan,
    isScanning,
    reset: resetScan,
    result: scanResult,
    error: scanError,
  } = useScanner();
  const { data: device } = useConnectedDevice();
  const { showToast } = useToast();
  const { nextStep } = useMeasurementFlowStore();

  const protocol = protocols?.find((p) => p.value === content.protocolId);

  // Auto-proceed to next step when scan completes successfully
  React.useEffect(() => {
    if (scanResult && !isScanning) {
      // Small delay to show completion briefly
      const timer = setTimeout(() => {
        nextStep();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [scanResult, isScanning, nextStep]);

  const handleStartScan = async () => {
    if (!device) {
      showToast("Not connected to sensor", "error");
      return;
    }
    if (!content.protocolId) {
      showToast("No protocol selected", "error");
      return;
    }

    resetScan();
    try {
      // For measurement node, we only execute the protocol scan, no macro
      await executeScan(content.protocolId, "");
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
      return <ErrorState error={scanError} onRetry={handleStartScan} />;
    }

    if (isScanning) {
      return <ScanningState onCancel={resetScan} scanResult={scanResult} />;
    }

    return <ReadyState protocol={protocol} onStartScan={handleStartScan} />;
  };

  return (
    <View className={clsx("rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Measurement</Text>
        {protocol && (
          <Text className={clsx("text-sm", classes.textSecondary)}>Protocol: {protocol.label}</Text>
        )}
      </View>

      <View className="p-4">{renderState()}</View>
    </View>
  );
}
