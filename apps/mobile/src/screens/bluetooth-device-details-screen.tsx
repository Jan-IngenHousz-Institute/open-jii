import { useAsync } from "react-async-hook";
import { Text, View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import {
  bluetoothDeviceToMultispeqStream,
  connectWithBluetoothDevice,
} from "../services/bluetooth-classic";

const protocol = [{ spad: [1] }];

export function BluetoothDeviceDetailsScreen({ route }: any) {
  const { deviceId } = route.params;

  const { result, loading, error } = useAsync(async () => {
    const device = await connectWithBluetoothDevice(deviceId);
    const multispeqEmitter = bluetoothDeviceToMultispeqStream(device);

    multispeqEmitter.on("receivedReplyFromDevice", ({ data }) => {
      console.log("got reply from device", data);
    });

    multispeqEmitter.emit("sendCommandToDevice", "hello");
    return { emitter: multispeqEmitter, device };
  }, [deviceId]);

  if (loading) {
    return <LargeSpinner>Connecting to device...</LargeSpinner>;
  }

  if (error || !result) {
    return <ErrorView error={error ?? "Cannot connect"} />;
  }

  const { device, emitter } = result;

  function handleScan() {
    emitter.emit("sendCommandToDevice", protocol);
  }

  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-2xl font-bold mb-4">
        {device.name || "Unknown Device"}
      </Text>
      <Text className="text-base text-gray-700 mb-2">ID: {device.id}</Text>
      <Text className="text-base text-gray-700 mb-2">
        RSSI: {(device.extra as any)?.rssi ?? "N/A"} dBm
      </Text>
      <Text className="text-base text-gray-700">
        Bonded: {device.bonded ? "Yes" : "No"}
      </Text>
      <BigActionButton onPress={handleScan} text="Start Scan" />
    </View>
  );
}
