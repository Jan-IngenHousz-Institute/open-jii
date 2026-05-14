import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useConnectToDevice } from "~/features/connection/services/device-connection-manager/device-connection-hooks";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

export function NoDeviceState() {
  const { lastConnectedDevice } = useDeviceConnectionStore();
  const { connectToDevice, connectingDeviceId } = useConnectToDevice();
  const { t } = useTranslation("measurementFlow");

  const isReconnecting =
    lastConnectedDevice !== undefined && connectingDeviceId === lastConnectedDevice.id;

  // If a previous device is known, offer an inline reconnect so the user
  // doesn't have to leave the measurement flow to re-establish the connection.
  if (lastConnectedDevice) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        {isReconnecting ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            <Text className="text-muted-foreground text-center text-sm">
              {t("measurementFlow:measurementNode.noDevice.disconnected", {
                name: lastConnectedDevice.name,
              })}
            </Text>
            <Button
              title={t("measurementFlow:measurementNode.noDevice.reconnect", {
                name: lastConnectedDevice.name,
              })}
              onPress={() => void connectToDevice(lastConnectedDevice)}
              isDisabled={!!connectingDeviceId}
              style={{ height: 44, width: "100%" }}
            />
            <Button
              title={t("measurementFlow:measurementNode.noDevice.connectDifferent")}
              onPress={() => router.push("/(tabs)/")}
              variant="tertiary"
              isDisabled={!!connectingDeviceId}
              style={{ height: 44, width: "100%" }}
            />
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center">
      <Button
        title={t("measurementFlow:measurementNode.noDevice.connectFirst")}
        onPress={() => router.push("/(tabs)/")}
        style={{ height: 44 }}
      />
    </View>
  );
}
