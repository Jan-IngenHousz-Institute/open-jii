import { clsx } from "clsx";
import { Info } from "lucide-react-native";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { Button } from "~/components/Button";
import { useProtocol } from "~/hooks/use-protocol";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-hooks";
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
  const { classes, colors } = useTheme();
  const { protocol } = useProtocol(content.protocolId);
  const {
    executeScan,
    isScanning,
    reset: resetScan,
    result: scanResult,
    error: scanError,
  } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep, setScanResult, setProtocolId, setCurrentFlowStep } = useMeasurementFlowStore();

  useEffect(() => {
    setProtocolId(content.protocolId);
  }, [setProtocolId, content.protocolId]);

  const handleCardPress = (flowStepIndex: number) => {
    setCurrentFlowStep(flowStepIndex);
  };

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
      if (!protocol) {
        throw new Error("No protocol");
      }

      const result = await executeScan(protocol);
      setScanResult(result);
      // Play system notification sound when measurement completes
      await playSound();
      nextStep();
    } catch (error) {
      console.log("scan error", error);
      toast.error("Scan error");
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
          <View className="px-4 py-3">
            <Button
              title="Retry"
              onPress={handleStartScan}
              variant="danger"
              style={{ height: 44 }}
            />
          </View>
        </View>
      );
    }

    if (isScanning) {
      return (
        <View className="flex-1">
          <View className="flex-1 p-4">
            <ScanningState scanResult={scanResult} protocolName={protocol?.name} />
          </View>
          <View className="gap-4 px-4 py-3">
            <View className="flex-row items-center gap-2 rounded-lg bg-[#EDF2F6] p-2">
              <Info size={16} color={colors.primary.dark} />
              <Text className={clsx("flex-1 text-sm", classes.textMuted)}>
                Your (gps)location and full name will be stored amongst other measurements data.
                Note that these are publicly available.
              </Text>
            </View>

            <Button title="Cancel Measurement" onPress={resetScan} style={{ height: 44 }} />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <ReadyState onCardPress={handleCardPress} />
        <View className="px-4 py-3">
          <Button title="Start measurement" onPress={handleStartScan} style={{ height: 44 }} />
        </View>
      </View>
    );
  };

  return <View className="flex-1 rounded-xl">{renderState()}</View>;
}
