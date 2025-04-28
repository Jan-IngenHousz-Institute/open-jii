export interface BluetoothDevice {
  id: string;
  isConnectable: boolean;
  localName: string | null;
  manufacturerData: any;
  mtu: number;
  name: string | null;
  overflowServiceUUIDs: any;
  rawScanRecord: string;
  rssi: number;
  serviceData: any;
  serviceUUIDs: any;
  solicitedServiceUUIDs: any;
  txPowerLevel: number;
}
