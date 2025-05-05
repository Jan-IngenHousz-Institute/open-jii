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
    <View className="w-full flex-1 bg-neutral-100">
      <Text className="mb-4 mt-6 text-center text-2xl font-bold text-neutral-800">
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
