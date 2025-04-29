import { useAsync } from "react-async-hook";
import { Text, View } from "react-native";

import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { connectWithBluetoothDevice } from "../services/bluetooth-classic";

export function BluetoothDeviceDetailsScreen({ route }: any) {
  const { deviceId } = route.params;

  const {
    result: device,
    loading,
    error,
  } = useAsync(() => connectWithBluetoothDevice(deviceId), [deviceId]);

  if (loading) {
    return <LargeSpinner>Connecting to device...</LargeSpinner>;
  }

  if (error || !device) {
    return <ErrorView error={error ?? "Cannot connect"} />;
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
    </View>
  );
}
