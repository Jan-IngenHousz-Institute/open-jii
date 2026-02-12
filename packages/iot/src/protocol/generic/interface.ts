/**
 * Generic device protocol types
 * For Arduino, Raspberry Pi, custom sensors, weather stations, etc.
 */

/** Generic device events */
export interface GenericDeviceEvents extends Record<string, unknown> {
  sendCommand: string | object;
  receivedResponse: unknown;
  destroy: void;
}

/** Generic device information */
export interface GenericDeviceInfo {
  device_name?: string;
  device_type?: string;
  device_version?: string;
  device_id?: string;
  firmware_version?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

/** Generic command response */
export interface GenericCommandResponse<T = unknown> {
  status: "success" | "error";
  data?: T;
  error?: string;
  timestamp?: number;
}

/** Configuration/Protocol to send to device */
export interface GenericDeviceConfig {
  /** Configuration as JSON object (any structure) */
  config: Record<string, unknown>;
  /** Optional configuration ID/name */
  id?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Measurement data from device */
export interface GenericMeasurementData<T = unknown> {
  /** Measurement values */
  data: T;
  /** When the measurement was taken */
  timestamp?: number;
  /** Optional measurement ID */
  id?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
