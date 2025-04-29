import { useAsync } from "react-async-hook";
import { FlatList, Text, View } from "react-native";

import { LargeSpinner } from "../components/large-spinner";
import { getBluetoothClassicDevices } from "../services/bluetooth-classic";

export function BluetoothDevicesListScreen() {
  const {
    error,
    loading,
    result: data,
  } = useAsync(async () => {
    const devices = await getBluetoothClassicDevices();
    return { devices };
  }, []);

  if (loading) {
    return <LargeSpinner>Scanning for Bluetooth devices...</LargeSpinner>;
  }

  if (error || !data) {
    return (
      <View className="flex-1 justify-center items-center bg-white w-full">
        <Text className="text-lg font-semibold text-red-500">
          Error loading devices
        </Text>
      </View>
    );
  }

  const { devices = [] } = data;
  console.log("device 0", devices[0]);

  return (
    <View className="flex-1 bg-white w-full">
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={devices}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Text className="text-2xl font-bold mb-4">
            Nearby Bluetooth Devices
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border rounded-2xl p-4 mb-4 shadow-sm bg-gray-50 w-full">
            <Text className="text-lg font-semibold mb-1">
              {item.name || "Unknown Device"}
            </Text>
            <Text className="text-sm text-gray-600 mb-1">ID: {item.id}</Text>
            <Text className="text-sm text-gray-600 mb-1">
              RSSI: {(item.extra as any).rssi} dBm
            </Text>
          </View>
        )}
      />
    </View>
  );
}
