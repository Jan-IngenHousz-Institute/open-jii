import { Device } from 'react-native-ble-plx'

import { BluetoothDevice } from './bluetooth-device'

export function serializeDevice(device: Device): BluetoothDevice {
  return {
    id: device.id,
    isConnectable: device.isConnectable ?? false,
    localName: device.localName,
    manufacturerData: device.manufacturerData,
    mtu: device.mtu,
    name: device.name,
    overflowServiceUUIDs: device.overflowServiceUUIDs,
    rawScanRecord: device.rawScanRecord,
    rssi: device.rssi ?? -999, // fallback if null
    serviceData: device.serviceData,
    serviceUUIDs: device.serviceUUIDs,
    solicitedServiceUUIDs: device.solicitedServiceUUIDs,
    txPowerLevel: device.txPowerLevel ?? 0
  }
}
