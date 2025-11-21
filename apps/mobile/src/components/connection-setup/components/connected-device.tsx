import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";
import { useScannerCommandExecutor } from "~/services/scan-manager/use-scanner-command-executor";
import type { Device } from "~/types/device";

interface Props {
  device: Device;
  onDisconnect?: (device: Device) => void | Promise<void>;
}

export function ConnectedDevice(props: Props) {
  const { device, onDisconnect } = props;
  const { classes, colors, isDark } = useTheme();
  const { executeCommand, isExecuting } = useScannerCommandExecutor();

  const accent = isDark ? colors.primary.bright : colors.primary.dark;

  return (
    <Card style={{ marginBottom: 16 }}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={clsx("text-sm font-semibold", classes.text)}>Connected Device</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: accent + "22" }}>
          <Text style={{ color: accent }} className="text-xs font-semibold">
            Connected
          </Text>
        </View>
      </View>
      <Text className={clsx("mb-0.5 text-base font-bold", classes.text)}>{device.name}</Text>
      <Text className={clsx("text-xs", classes.textMuted)}>
        {device.type} • {device.id}
      </Text>
      {!!onDisconnect && (
        <View className="mt-3 flex-row items-stretch gap-2">
          <Button title="Disconnect" onPress={() => onDisconnect(device)} style={{ flex: 1 }} />
          <Button
            disabled={isExecuting}
            title="Turn off MultispeQ"
            onPress={async () => {
              await executeCommand("sleep");
              onDisconnect(device);
            }}
            variant="ghost"
            style={{ backgroundColor: "#E2FCFC", minWidth: 120 }}
            textStyle={{ color: "#005E5E" }}
          />
        </View>
      )}
    </Card>
  );
}
