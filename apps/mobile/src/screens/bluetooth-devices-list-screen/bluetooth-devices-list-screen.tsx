import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAsync } from "react-async-hook";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { BigActionButton } from "../../components/big-action-button";
import { ErrorView } from "../../components/error-view";
import { LargeSpinner } from "../../components/large-spinner";
import { BluetoothStackParamList } from "../../navigation/bluetooth-stack";
import { getBluetoothClassicDevices } from "../../services/bluetooth-classic";
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
      <View className="flex-1 items-center bg-white w-full justify-between p-4">
        <ErrorView error="Cannot scan for Bluetooth devices. Please try again." />
        <BigActionButton onPress={() => refreshDevices()} text="Restart Scan" />
      </View>
    );
  }

  const sortedDevices = [...devices].sort(compareBluetoothDevices);

  return (
    <View className="flex-1 bg-white justify-between w-full">
      <FlatList
        onRefresh={() => refreshDevices()}
        refreshing={false}
        contentContainerStyle={{ padding: 16 }}
        data={sortedDevices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="border rounded-2xl p-4 mb-4 bg-gray-50 w-full"
            onPress={() =>
              navigation.navigate("DeviceDetails", { deviceId: item.id })
            }
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-semibold">
                {item.name || "Unknown Device"}
              </Text>
              {item.bonded && (
                <View className="px-2 py-0.5 rounded-full bg-green-100">
                  <Text className="text-xs text-green-700 font-semibold">
                    Paired
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-gray-600 mb-1">ID: {item.id}</Text>
            <Text className="text-sm text-gray-600 mb-1">
              RSSI: {(item.extra as any)?.rssi ?? "N/A"} dBm
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
