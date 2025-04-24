import React from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'

import { BluetoothDevice } from '../../utils/bluetooth-device'

function handleCardPress(device: BluetoothDevice) {
  Alert.alert('Device Selected', `${device.name ?? device.id}`)
}

export function ItemCard({ item }: { item: BluetoothDevice }) {
  return (
    <TouchableOpacity onPress={() => handleCardPress(item)} className="mb-3 rounded-xl bg-white p-4 shadow-md">
      <View>
        <Text className="text-lg font-semibold mb-1">Name</Text>
        <Text className="text-base mb-2">{item.name ?? item.id ?? 'N/A'}</Text>

        <View className="flex-row justify-between my-1">
          <Text>Connectable: {item.isConnectable ? 'Yes' : 'No'}</Text>
          <Text>MTU: {item.mtu}</Text>
        </View>

        <View className="flex-row justify-between my-1">
          <Text>RSSI: {item.rssi}</Text>
          <Text>Tx Power: {item.txPowerLevel}</Text>
        </View>

        <Text numberOfLines={1} className="mt-2 italic text-neutral-500">
          ID: {item.id ?? 'N/A'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
