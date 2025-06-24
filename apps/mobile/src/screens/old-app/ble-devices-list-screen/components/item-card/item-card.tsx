import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import type { BluetoothDevice } from "../../utils/bluetooth-device";

export function ItemCard({
  item,
  onPress,
}: {
  item: BluetoothDevice;
  onPress: (item: BluetoothDevice) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onPress?.(item)}
      className="mb-3 rounded-xl bg-white p-4 shadow-md"
    >
      <View>
        <Text className="mb-1 text-lg font-semibold">Name</Text>
        <Text className="mb-2 text-base">{(item.name ?? item.id) || "N/A"}</Text>

        <View className="my-1 flex-row justify-between">
          <Text>Connectable: {item.isConnectable ? "Yes" : "No"}</Text>
          <Text>MTU: {item.mtu}</Text>
        </View>

        <View className="my-1 flex-row justify-between">
          <Text>RSSI: {item.rssi}</Text>
          <Text>Tx Power: {item.txPowerLevel}</Text>
        </View>

        <Text numberOfLines={1} className="mt-2 italic text-neutral-500">
          ID: {item.id ?? "N/A"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
