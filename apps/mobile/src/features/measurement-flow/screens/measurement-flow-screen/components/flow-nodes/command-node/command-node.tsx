import { clsx } from "clsx";
import { Terminal } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import type { ScanResult } from "~/features/measurement-flow/domain/flow-transitions";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import type { InlineCommandContent } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { resolveInlineCommand } from "@repo/api/utils/command-payload";

const log = createLogger("command-node");

interface CommandNodeProps {
  content: InlineCommandContent;
  /** Flow node id (== cell id); keys the result so a downstream branch can read it. */
  nodeId: string;
}

function formatResponse(result: unknown): string {
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
  const { executeCommand } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep, setScanResult } = useMeasurementFlowStore();

  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<string>();
  const [error, setError] = useState<string>();

  const handleRun = async () => {
    if (!device) {
      toast.error(t("measurementFlow:commandNode.toast.notConnected"));
      return;
    }
    setError(undefined);
    setIsRunning(true);
    try {
      const result = await executeCommand(resolveInlineCommand(content));
      setResponse(formatResponse(result));
      // Persist so a downstream branch can read this command's output and it
      // uploads as a measurement, mirroring MeasurementNode.
      setScanResult(result as ScanResult | undefined, nodeId);
    } catch (err) {
      log.error("command error", { err: (err as Error)?.message });
      setError((err as Error)?.message);
      toast.error(t("measurementFlow:commandNode.toast.error"));
    } finally {
      setIsRunning(false);
    }
  };

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
          <Text className={clsx("font-mono text-sm", classes.text)}>{content.content}</Text>
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
        <Button
          title={
            isRunning
              ? t("measurementFlow:commandNode.running")
              : t("measurementFlow:commandNode.run")
          }
          onPress={handleRun}
          disabled={isRunning}
          style={{ height: 44 }}
        />
        {response !== undefined ? (
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
