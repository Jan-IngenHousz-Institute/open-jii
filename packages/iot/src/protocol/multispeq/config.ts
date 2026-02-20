/**
 * MultispeQ Protocol Configuration
 */

/** MultispeQ BLE GATT UUIDs */
export const MULTISPEQ_BLE_UUIDS = {
  SERVICE: "12345678-1234-5678-1234-56789abcdef1",
  WRITE: "abcdef01-1234-5678-9abc-def012345679",
  NOTIFY: "abcdef02-1234-5678-9abc-def012345679",
} as const;

/** BLE configuration for MultispeQ devices */
export interface BLEConfig {
  serviceUUID: string;
  writeUUID: string;
  notifyUUID: string;
}

export const MULTISPEQ_BLE_CONFIG: BLEConfig = {
  serviceUUID: MULTISPEQ_BLE_UUIDS.SERVICE,
  writeUUID: MULTISPEQ_BLE_UUIDS.WRITE,
  notifyUUID: MULTISPEQ_BLE_UUIDS.NOTIFY,
};
