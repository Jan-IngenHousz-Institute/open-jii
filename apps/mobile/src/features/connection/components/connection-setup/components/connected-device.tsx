import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useScannerCommandExecutor } from "~/features/connection/services/scan-manager/use-scanner-command-executor";
import type { Device } from "~/shared/types/device";

interface Props {
  device: Device;
  onDisconnect?: (device: Device) => void | Promise<void>;
}

export function ConnectedDevice(props: Props) {
  const { device, onDisconnect } = props;
  const { executeCommand, isExecuting } = useScannerCommandExecutor();

  return (
    <Card className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-foreground text-sm font-semibold">Connected Device</Text>
        <View className="bg-jii-primary/15 dark:bg-jii-primary-bright/15 rounded-full px-2 py-0.5">
          <Text className="text-jii-primary dark:text-jii-primary-bright text-xs font-semibold">
            Connected
          </Text>
        </View>
      </View>
      <Text className="text-foreground mb-0.5 text-base font-bold">{device.name}</Text>
      <Text className="text-muted-foreground text-xs">
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
            variant="tertiary"
            style={{ minWidth: 120 }}
          />
        </View>
      )}
    </Card>
  );
}
