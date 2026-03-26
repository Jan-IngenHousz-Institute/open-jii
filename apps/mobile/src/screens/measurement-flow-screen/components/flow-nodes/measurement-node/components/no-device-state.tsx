import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "~/components/Button";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useConnectToDevice } from "~/services/device-connection-manager/device-connection-hooks";

export function NoDeviceState() {
  const { lastConnectedDevice } = useDeviceConnectionStore();
  const { connectToDevice, connectingDeviceId } = useConnectToDevice();

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
            <Text className="text-center text-sm text-gray-500">
              Device disconnected — {lastConnectedDevice.name}
            </Text>
            <Button
              title={`Reconnect to ${lastConnectedDevice.name}`}
              onPress={() => void connectToDevice(lastConnectedDevice)}
              isDisabled={!!connectingDeviceId}
              style={{ height: 44, width: "100%" }}
            />
            <Button
              title="Connect a different device"
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
        title="Please connect to a device first"
        onPress={() => router.push("/(tabs)/")}
        style={{ height: 44 }}
      />
    </View>
  );
}
