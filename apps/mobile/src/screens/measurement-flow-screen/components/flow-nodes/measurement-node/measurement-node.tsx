import { clsx } from "clsx";
import { useRouter } from "expo-router";
import { Info } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
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
    cancelCommand,
  } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep, setScanResult, setProtocolId, navigateToQuestionFromOverview } =
    useMeasurementFlowStore();
  const router = useRouter();
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
          <View className="flex-row gap-4 px-4 py-3">
            <Button
              title="Retry measurement"
              onPress={handleStartScan}
              variant="tertiary"
              style={{ flex: 1, height: 44, borderColor: "transparent" }}
            />
            <Button
              title="Connect to device"
              onPress={() => router.push("/(tabs)/")}
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
            <View className="flex-row items-center gap-2 rounded-lg bg-[#EDF2F6] p-2">
              <Info size={16} color={colors.primary.dark} />
              <Text className={clsx("flex-1 text-sm leading-relaxed", classes.textMuted)}>
                Your (gps)location and full name will be stored amongst other measurements data.
                Note that these are publicly available.
              </Text>
            </View>

            <Button
              title="Cancel Measurement"
              onPress={() => {
                void cancelCommand();
                resetScan();
              }}
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
          <Button title="Start measurement" onPress={handleStartScan} style={{ height: 44 }} />
        </View>
      </View>
    );
  };

  return <View className="flex-1 rounded-xl">{renderState()}</View>;
}
