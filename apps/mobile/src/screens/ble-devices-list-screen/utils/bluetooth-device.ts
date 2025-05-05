export interface BluetoothDevice {
  id: string;
  isConnectable: boolean;
  localName: string | null;
  manufacturerData: unknown;
  mtu: number;
  name: string | null;
  overflowServiceUUIDs: unknown;
  rawScanRecord: string;
  rssi: number;
  serviceData: unknown;
  serviceUUIDs: unknown;
  solicitedServiceUUIDs: unknown;
  txPowerLevel: number;
}
