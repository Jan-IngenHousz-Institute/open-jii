import React from 'react'
import { FlatList, Text, View } from 'react-native'

import { BluetoothDevice } from '../../../utils/bluetooth-device'
import { ItemCard } from '../item-card'

function getKey(item: BluetoothDevice) {
  return item.id
}

function renderItem({ item }: { item: BluetoothDevice }) {
  return <ItemCard item={item} />
}

export function DevicesListView({ items, onRefresh }: { items: BluetoothDevice[]; onRefresh(): void }) {
  return (
    <View className="flex-1 bg-neutral-100 w-full">
      <Text className="text-2xl font-bold text-center mt-6 mb-4 text-neutral-800">{items.length} Devices Found</Text>
      <FlatList
        data={items}
        keyExtractor={getKey}
        renderItem={renderItem}
        contentContainerClassName="p-4"
        onRefresh={onRefresh}
        refreshing={false}
      />
    </View>
  )
}
