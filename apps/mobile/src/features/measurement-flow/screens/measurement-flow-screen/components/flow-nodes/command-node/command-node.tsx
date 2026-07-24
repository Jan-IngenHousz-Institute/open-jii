import { clsx } from "clsx";
import { Terminal } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { toast } from "sonner-native";
import { useConnectedDevices } from "~/features/connection/hooks/use-device-connection";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type {
  ScanResult,
  ScanResultEntry,
} from "~/features/measurement-flow/domain/flow-transitions";
import {
  commandFailureLogFields,
  commandFailureTranslationKey,
  resolveMobileCommand,
} from "~/features/measurement-flow/domain/mobile-command-resolution";
import type { MobileCommandResolutionFailureCode } from "~/features/measurement-flow/domain/mobile-command-resolution";
import type { DeviceProducerOutcome } from "~/features/measurement-flow/domain/runtime-output";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { InlineCommandContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { isReferencedCommand } from "@repo/api/domains/workbook/command-source.schema";

const log = createLogger("command-node");

interface CommandNodeProps {
  content: InlineCommandContent;
  /** Flow node id (== raw workbook command cell id). */
  nodeId: string;
}

interface DeviceCommandView {
  deviceId: string;
  deviceName: string;
  resolved?: string;
  response?: string;
  failureCode?: MobileCommandResolutionFailureCode | "COMMAND_TRANSPORT_FAILED";
  failureMessage?: string;
}

function formatValue(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function CommandNode({ content, nodeId }: CommandNodeProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { data: devices = [] } = useConnectedDevices();
  const executeCommandOn = useScannerCommandExecutorStore((state) => state.executeCommandOn);
  const {
    nextStep,
    cells,
    workbookVersionId,
    executionEpoch,
    getRuntimeCellOutput,
    recordDeviceProducerOutcomes,
    setScanResults,
  } = useMeasurementFlowStore();

  const [isRunning, setIsRunning] = useState(false);
  const [deviceViews, setDeviceViews] = useState<DeviceCommandView[]>([]);

  // Resolved previews and errors are cycle state, never authored payload. A
  // retry/version change rotates provenance and must clear them immediately.
  useEffect(() => {
    setDeviceViews([]);
  }, [executionEpoch, workbookVersionId]);

  const handleRun = async () => {
    if (devices.length === 0) {
      toast.error(t("measurementFlow:commandNode.toast.notConnected"));
      return;
    }

    setIsRunning(true);
    const initialViews: DeviceCommandView[] = [];
    const assignments: { device: (typeof devices)[number]; command: string | object }[] = [];

    for (const device of devices) {
      const resolved = resolveMobileCommand({
        commandCellId: nodeId,
        cells,
        targetDeviceId: device.id,
        workbookVersionId,
        executionEpoch,
        getRuntimeCellOutput,
      });
      if (!resolved.ok) {
        log.warn(
          "command resolution failed",
          commandFailureLogFields("direct", resolved.error, {
            workbookVersionId,
            executionEpoch,
          }),
        );
        initialViews.push({
          deviceId: device.id,
          deviceName: device.name,
          failureCode: resolved.error.code,
          failureMessage: t(commandFailureTranslationKey(resolved.error.code)),
        });
        continue;
      }
      assignments.push({ device, command: resolved.value });
      initialViews.push({
        deviceId: device.id,
        deviceName: device.name,
        resolved: formatValue(resolved.value),
      });
    }
    setDeviceViews(initialViews);

    if (assignments.length === 0) {
      setIsRunning(false);
      return;
    }

    const settled = await Promise.allSettled(
      assignments.map(({ device, command }) => executeCommandOn(device.id, command)),
    );
    const outcomes: DeviceProducerOutcome[] = [];
    const projection: ScanResultEntry[] = [];
    const completed = new Map<
      string,
      Pick<DeviceCommandView, "response" | "failureCode" | "failureMessage">
    >();
    assignments.forEach(({ device, command }, index) => {
      const result = settled[index];
      if (result.status === "fulfilled") {
        outcomes.push({ device: { id: device.id, name: device.name }, data: result.value });
        const projectedResult: ScanResult =
          typeof result.value === "object" && result.value !== null && !Array.isArray(result.value)
            ? (result.value as ScanResult)
            : { response: result.value };
        projection.push({
          device: { id: device.id, name: device.name },
          result: projectedResult,
          producerCellId: nodeId,
          producerKind: "command",
          dispatchedCommand: command,
          ...(isReferencedCommand(content) ? { commandSource: content.ref } : {}),
          ...(executionEpoch ? { executionEpoch } : {}),
        });
        completed.set(device.id, { response: formatValue(result.value) });
      } else {
        outcomes.push({
          device: { id: device.id, name: device.name },
          error: "COMMAND_EXECUTION_FAILED",
        });
        completed.set(device.id, {
          failureCode: "COMMAND_TRANSPORT_FAILED",
          failureMessage: t("measurementFlow:commandNode.resolution.COMMAND_TRANSPORT_FAILED"),
        });
        log.warn("command transport failed", {
          operation: "direct",
          code: "COMMAND_TRANSPORT_FAILED",
          commandCellId: nodeId,
          targetDeviceId: device.id,
          workbookVersionId,
          executionEpoch,
        });
      }
    });

    // Compatibility-only upload/UI projection. Resolution continues to read
    // exclusively through outputsByCellId/getRuntimeCellOutput.
    setScanResults(projection, nodeId);
    recordDeviceProducerOutcomes(nodeId, "command", outcomes);
    setDeviceViews((current) =>
      current.map((view) => ({ ...view, ...completed.get(view.deviceId) })),
    );
    setIsRunning(false);
  };

  const authoredSummary = isReferencedCommand(content)
    ? t("measurementFlow:commandNode.dynamicSummary", { field: content.ref.field })
    : content.content;
  const hasResponse = deviceViews.some((view) => view.response !== undefined);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Terminal size={18} color="#119DA4" />
          <Text className={clsx("text-base font-semibold", classes.text)}>
            {t("measurementFlow:commandNode.heading")}
          </Text>
        </View>

        <View className="bg-muted rounded-lg p-3">
          <Text className={clsx("font-mono text-sm", classes.text)}>{authoredSummary}</Text>
        </View>

        {deviceViews.map((view) => (
          <View key={view.deviceId} className="gap-1 rounded-lg border border-gray-200 p-3">
            <Text className={clsx("text-sm font-semibold", classes.text)}>{view.deviceName}</Text>
            {view.resolved !== undefined ? (
              <Text className={clsx("font-mono text-sm", classes.text)}>{view.resolved}</Text>
            ) : null}
            {view.failureMessage ? (
              <Text className="text-sm text-red-500">{view.failureMessage}</Text>
            ) : null}
            {view.response !== undefined ? (
              <>
                <Text className={clsx("text-xs uppercase", classes.textMuted)}>
                  {t("measurementFlow:commandNode.responseLabel")}
                </Text>
                <Text className={clsx("font-mono text-sm", classes.text)}>{view.response}</Text>
              </>
            ) : null}
          </View>
        ))}
      </View>

      <View className="gap-3 px-4 py-3">
        <Button
          title={
            isRunning
              ? t("measurementFlow:commandNode.running")
              : t("measurementFlow:commandNode.run")
          }
          onPress={() => void handleRun()}
          disabled={isRunning}
          style={{ height: 44 }}
        />
        {hasResponse ? (
          <Button
            title={t("measurementFlow:commandNode.continue")}
            onPress={() => nextStep()}
            variant="tertiary"
            style={{ height: 44, borderColor: "transparent" }}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
