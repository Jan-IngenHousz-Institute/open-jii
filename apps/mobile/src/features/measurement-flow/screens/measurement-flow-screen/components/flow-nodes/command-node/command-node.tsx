import { clsx } from "clsx";
import { Terminal } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { toast } from "sonner-native";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import type { DeviceCommandOption } from "@repo/api/schemas/device-command.schema";
import { KNOWN_DEVICE_COMMANDS } from "@repo/api/schemas/device-command.schema";

import { NoDeviceState } from "../measurement-node/components/no-device-state";

const log = createLogger("command-node");

const COMMANDS: readonly DeviceCommandOption[] = KNOWN_DEVICE_COMMANDS;

interface CommandNodeProps {
  content: {
    command: string;
  };
}

function formatResponse(response: string | object | undefined): string {
  if (response === undefined) return "";
  return typeof response === "string" ? response : JSON.stringify(response, null, 2);
}

export function CommandNode({ content }: CommandNodeProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { executeCommand } = useScanner();
  const { data: device } = useConnectedDevice();
  const { nextStep } = useMeasurementFlowStore();

  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const option = COMMANDS.find((c) => c.value === content.command);

  const handleRun = async () => {
    if (!device) {
      toast.error(t("measurementFlow:commandNode.toast.notConnected"));
      return;
    }
    setError(undefined);
    setIsRunning(true);
    try {
      const result = await executeCommand(content.command);
      setResponse(formatResponse(result));
    } catch (err) {
      log.error("command error", { err: (err as Error)?.message });
      setError((err as Error)?.message);
      toast.error(t("measurementFlow:commandNode.toast.error"));
    } finally {
      setIsRunning(false);
    }
  };

  if (!device) {
    return (
      <View className="flex-1">
        <NoDeviceState />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 pt-4">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <View className="flex-row items-center gap-2">
          <Terminal size={18} />
          <Text className={clsx("text-lg font-bold", classes.text)}>
            {t("measurementFlow:commandNode.heading")}
          </Text>
        </View>

        <View className="bg-muted mt-3 rounded-lg p-3">
          <Text className={clsx("font-mono text-base", classes.text)}>{content.command}</Text>
          {option?.description ? (
            <Text className={clsx("mt-1 text-sm", classes.textMuted)}>{option.description}</Text>
          ) : null}
        </View>

        {response !== undefined ? (
          <View className="bg-muted mt-3 rounded-lg p-3">
            <Text className={clsx("mb-1 text-xs font-medium uppercase", classes.textMuted)}>
              {t("measurementFlow:commandNode.responseLabel")}
            </Text>
            <Text className={clsx("font-mono text-sm", classes.text)}>{response}</Text>
          </View>
        ) : null}

        {error ? <Text className="mt-3 text-sm text-red-500">{error}</Text> : null}
      </ScrollView>

      <View className="gap-3 px-0 py-3">
        {response !== undefined ? (
          <Button
            title={t("measurementFlow:commandNode.continue")}
            onPress={nextStep}
            style={{ height: 44 }}
          />
        ) : (
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
        )}
      </View>
    </View>
  );
}
