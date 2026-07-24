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

import { DeviceScanProgressList } from "./components/device-scan-progress-list";
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
    deviceStates,
    lastRound,
    succeededCount,
    startScan,
    cancelScan,
    completeWithSuccesses,
    openDeviceSheet,
    navigateToQuestionFromOverview,
    scanProgress,
    scanStartedAt,
    estimatedMs,
    commandDispatchPreviews = [],
  } = useMeasurementCapture(content, nodeId);

  const renderState = () => {
    if (!device) {
      return <NoDeviceState />;
    }

    if (!isScanning && lastRound && lastRound.failures.length > 0) {
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
              onPress={startScan}
              variant="tertiary"
              style={{ flex: 1, height: 44, borderColor: "transparent" }}
            />
            <Button
              title={t("measurementFlow:measurementNode.multiScan.continueWithSuccessful", {
                count: succeededCount,
              })}
              onPress={completeWithSuccesses}
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
            <ScanningState
              protocolName={protocol?.name}
              deviceStates={deviceStates}
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

  return (
    <View className="flex-1 rounded-xl">
      {commandDispatchPreviews.length > 0 ? (
        <View className="gap-2 px-4 pt-3">
          {commandDispatchPreviews.map((preview) => (
            <View key={preview.deviceId} className="bg-muted rounded-lg p-2">
              <Text className={clsx("text-sm font-semibold", classes.text)}>
                {preview.deviceName}
              </Text>
              {preview.resolved ? (
                <Text className={clsx("font-mono text-sm", classes.text)}>{preview.resolved}</Text>
              ) : null}
              {preview.error ? <Text className="text-sm text-red-500">{preview.error}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {renderState()}
    </View>
  );
}
