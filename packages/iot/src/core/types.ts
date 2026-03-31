/**
 * Core device types
 */

/** Supported transport types */
export type TransportType = "bluetooth-classic" | "ble" | "usb" | "web-bluetooth" | "web-serial";

/**
 * Platform-agnostic transport capabilities.
 *
 * Each driver declares which _abstract_ transport categories it supports.
 * Platform layers (web, React Native) map these to concrete adapters:
 *
 *   "bluetooth"  → Web Bluetooth (BLE)  / RN BLE / RN Bluetooth Classic
 *   "serial"     → Web Serial           / RN USB Serial
 *
 * This keeps the driver package platform-free while giving consumers
 * everything they need to build connection-type selectors.
 */
export type TransportCategory = "bluetooth" | "serial";

/** Supported device types */
export type DeviceType = "multispeq" | "generic";

/** Transport support declaration for a device type */
export interface DeviceTransportSupport {
  /** Abstract transport categories the device supports */
  supportedTransports: readonly TransportCategory[];
  /**
   * Whether the device supports BLE (Bluetooth Low Energy).
   * When false, Web Bluetooth cannot be used (it is BLE-only).
   */
  supportsBLE: boolean;
  /**
   * Whether the device supports Bluetooth Classic.
   * Bluetooth Classic is available on React Native but NOT on Web Bluetooth API.
   */
  supportsBluetoothClassic: boolean;
}

/**
 * Registry of transport support per device type.
 *
 * To add a new device, add an entry here and a corresponding driver.
 */
export const DEVICE_TRANSPORT_SUPPORT: Record<DeviceType, DeviceTransportSupport> = {
  multispeq: {
    // MultispeQ uses Bluetooth Classic, not BLE. Since Web Bluetooth is BLE-only,
    // "bluetooth" is intentionally excluded from supportedTransports on the web.
    // React Native layers should check supportsBluetoothClassic to offer BT Classic.
    supportedTransports: ["serial"],
    supportsBLE: false,
    supportsBluetoothClassic: true,
  },
  generic: {
    supportedTransports: ["bluetooth", "serial"],
    supportsBLE: true,
    supportsBluetoothClassic: false,
  },
};

/**
 * Get transport support info for a device type.
 */
export function getDeviceTransportSupport(deviceType: DeviceType): DeviceTransportSupport {
  return DEVICE_TRANSPORT_SUPPORT[deviceType];
}

/**
 * Check whether a device type supports a given transport category.
 */
export function isTransportSupported(
  deviceType: DeviceType,
  transport: TransportCategory,
): boolean {
  return getDeviceTransportSupport(deviceType).supportedTransports.includes(transport);
}

/** Generic device information */
export interface Device {
  /** Device unique identifier (MAC address, serial number, etc.) */
  id: string;
  /** Human-readable device name */
  name: string;
  /** Transport type used for connection */
  transportType: TransportType;
  /** Device type (driver) */
  deviceType: DeviceType;
  /** Signal strength (for wireless connections) */
  rssi?: number;
}

/** Device connection status */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Device connection info */
export interface DeviceConnectionInfo {
  device: Device;
  status: ConnectionStatus;
  batteryLevel?: number;
  error?: Error;
}
