import { clsx } from "clsx";
import { Info } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useMeasurementCapture } from "~/features/measurement-flow/hooks/use-measurement-capture";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { protocolRequiresInteraction } from "@repo/iot";

import { ErrorState } from "./components/error-state";
import { NoDeviceState } from "./components/no-device-state";
import { ReadyState } from "./components/ready-state";
import { ScanningState } from "./components/scanning-state";

interface MeasurementNodeProps {
  content: MeasurementContent;
  /** Flow node id (== cell id); keys the result so a downstream branch can read it. */
  nodeId: string;
}

export function MeasurementNode({ content, nodeId }: MeasurementNodeProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const {
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
  } = useMeasurementCapture(content, nodeId);

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
              onPress={startScan}
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
            <ScanningState
              protocolName={protocol?.name}
              progress={scanProgress}
              scanStartedAt={scanStartedAt}
              estimatedMs={estimatedMs}
              requiresInteraction={
                protocol?.code ? protocolRequiresInteraction(protocol.code) : false
              }
            />
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
              onPress={cancelScan}
              style={{ height: 44 }}
            />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <ReadyState onCardPress={navigateToQuestionFromOverview} />
        <View className="px-4 py-3">
          <Button
            title={t("measurementFlow:measurementNode.startMeasurement")}
            onPress={startScan}
            style={{ height: 44 }}
          />
        </View>
      </View>
    );
  };

  return <View className="flex-1 rounded-xl">{renderState()}</View>;
}
