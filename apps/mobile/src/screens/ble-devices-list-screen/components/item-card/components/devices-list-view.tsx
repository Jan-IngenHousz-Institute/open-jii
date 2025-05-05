import React from "react";
import { FlatList, Text, View } from "react-native";

import type { BluetoothDevice } from "../../../utils/bluetooth-device";
import { ItemCard } from "../item-card";

function getKey(item: BluetoothDevice) {
  return item.id;
}

function renderItem({ item }: { item: BluetoothDevice }) {
  return <ItemCard item={item} />;
}

export function DevicesListView({
  items,
  onRefresh,
}: {
  items: BluetoothDevice[];
  onRefresh(): void;
}) {
  return (
    <View className="flex-1 w-full bg-neutral-100">
      <Text className="mt-6 mb-4 text-2xl font-bold text-center text-neutral-800">
        {items.length} Devices Found
      </Text>
      <FlatList
        data={items}
        keyExtractor={getKey}
        renderItem={renderItem}
        contentContainerClassName="p-4"
        onRefresh={onRefresh}
        refreshing={false}
      />
    </View>
  );
}
