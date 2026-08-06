import { clsx } from "clsx";
import { Terminal } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useMeasurementCapture } from "~/features/measurement-flow/hooks/use-measurement-capture";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

function formatResponse(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

interface CommandNodeProps {
  content: MeasurementContent;
  nodeId: string;
  trackId?: string;
}

/** Runner-backed version of the shipped raw inline-command screen. */
export function CommandNode({ content, nodeId, trackId }: CommandNodeProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const runnerState = useMeasurementFlowStore((state) => state.runnerState);
  const nextStep = useMeasurementFlowStore((state) => state.nextStep);
  const continueTrack = useMeasurementFlowStore((state) => state.continueRunnerTrackInteraction);
  const { startScan, cancelScan, isScanning } = useMeasurementCapture(content, nodeId, trackId);
  const run = runnerState?.cellRuns[nodeId];
  const output = runnerState?.outputs[nodeId];
  const response =
    run?.status === "completed" ? formatResponse(output?.deviceResults ?? output?.v) : undefined;
  const error = run?.error;
  const command = content.command;

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
          <Text className={clsx("font-mono text-sm", classes.text)}>{command?.content}</Text>
        </View>

        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

        {response !== undefined ? (
          <View className="gap-1">
            <Text className={clsx("text-xs uppercase", classes.textMuted)}>
              {t("measurementFlow:commandNode.responseLabel")}
            </Text>
            <View className="bg-muted rounded-lg p-3">
              <Text className={clsx("font-mono text-sm", classes.text)}>{response}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="gap-3 px-4 py-3">
        {response === undefined ? (
          <Button
            title={
              isScanning
                ? t("measurementFlow:commandNode.running")
                : t("measurementFlow:commandNode.run")
            }
            onPress={isScanning ? cancelScan : startScan}
            style={{ height: 44 }}
          />
        ) : (
          <Button
            title={t("measurementFlow:commandNode.continue")}
            onPress={() => {
              if (trackId) continueTrack(trackId, nodeId);
              else nextStep();
            }}
            variant="tertiary"
            style={{ height: 44, borderColor: "transparent" }}
          />
        )}
      </View>
    </ScrollView>
  );
}
