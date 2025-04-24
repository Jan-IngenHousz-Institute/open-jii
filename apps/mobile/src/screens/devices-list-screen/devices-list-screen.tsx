import { useState } from 'react'
import { useAsync } from 'react-async-hook'
import { Text, View } from 'react-native'

import { startDeviceScan } from '../../services/bluetooth/start-devices-scan'
import { DevicesListView } from './components/item-card/components/devices-list-view'
import { BluetoothDevice } from './utils/bluetooth-device'
import { orderDevices } from './utils/order-devices'
import { serializeDevice } from './utils/serialize-device'
import { updateList } from './utils/update-list'

export function DevicesListScreen() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([])

  const { error } = useAsync(async () => {
    const emitter = await startDeviceScan()

    emitter.on('bluetoothDeviceFound', newDevice => {
      setDevices(devices => orderDevices(updateList(devices, serializeDevice(newDevice))))
    })

    emitter.on('bluetoothError', e => alert(e.message))

    return () => emitter.emit('destroy')
  }, [])

  if (error) {
    return (
      <View className="px-4 pt-3">
        <View className="bg-red-100 p-3 rounded-lg border border-red-300">
          <Text className="text-red-800 font-bold">⚠️ {error.message}</Text>
        </View>
      </View>
    )
  }

  return <DevicesListView items={devices} onRefresh={() => setDevices([])} />
}
