import React from "react";
import { FlatList, Text, View } from "react-native";

import type { BluetoothDevice } from "../../../utils/bluetooth-device";
import { ItemCard } from "../item-card";

function getKey(item: BluetoothDevice) {
  return item.id;
}

export function DevicesListView({
  items,
  onRefresh,
  onPress,
}: {
  items: BluetoothDevice[];
  onRefresh(): void;
  onPress?(id: string): void;
}) {
  return (
    <View className="w-full flex-1 bg-neutral-100">
      <Text className="mb-4 mt-6 text-center text-2xl font-bold text-neutral-800">
        {items.length} Devices Found
      </Text>
      <FlatList
        data={items}
        keyExtractor={getKey}
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={() => onPress?.(item.id)} />
        )}
        contentContainerClassName="p-4"
        onRefresh={onRefresh}
        refreshing={false}
      />
    </View>
  );
}
