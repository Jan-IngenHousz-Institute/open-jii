import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAsync } from "react-async-hook";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { BigActionButton } from "../../components/big-action-button";
import { ErrorView } from "../../components/error-view";
import { LargeSpinner } from "../../components/large-spinner";
import type { BluetoothStackParamList } from "../../navigation/bluetooth-stack";
import { getBluetoothClassicDevices } from "../../services/multispeq-communication/android-bluetooth-connection/get-bluetooth-classic-devices";
import { compareBluetoothDevices } from "./utils/compare-bluetooth-devices";

export function BluetoothDevicesListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<BluetoothStackParamList>>();

  const {
    error,
    loading,
    result: devices,
    execute: refreshDevices,
  } = useAsync(getBluetoothClassicDevices, []);

  if (loading && !devices) {
    return <LargeSpinner>Scanning for Bluetooth devices...</LargeSpinner>;
  }

  if (error || !devices) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <ErrorView error="Cannot scan for Bluetooth devices. Please try again." />
        <BigActionButton onPress={() => refreshDevices()} text="Restart Scan" />
      </View>
    );
  }

  const sortedDevices = [...devices].sort(compareBluetoothDevices);

  return (
    <View className="w-full flex-1 justify-between bg-white">
      <FlatList
        onRefresh={() => refreshDevices()}
        refreshing={false}
        contentContainerStyle={{ padding: 16 }}
        data={sortedDevices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="mb-4 w-full rounded-2xl border bg-gray-50 p-4"
            onPress={() =>
              navigation.navigate("DeviceDetails", { deviceId: item.id })
            }
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-lg font-semibold">
                {item.name || "Unknown Device"}
              </Text>
              {item.bonded && (
                <View className="rounded-full bg-green-100 px-2 py-0.5">
                  <Text className="text-xs font-semibold text-green-700">
                    Paired
                  </Text>
                </View>
              )}
            </View>
            <Text className="mb-1 text-sm text-gray-600">ID: {item.id}</Text>
            <Text className="mb-1 text-sm text-gray-600">
              RSSI: {(item.extra as any)?.rssi ?? "N/A"} dBm
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
