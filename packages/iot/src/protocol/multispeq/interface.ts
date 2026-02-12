/**
 * MultispeQ protocol types
 */

/** MultispeQ-specific events */
export interface MultispeqStreamEvents extends Record<string, unknown> {
  sendCommandToDevice: string | object;
  receivedReplyFromDevice: { data: unknown; checksum: string };
  destroy: void;
}

/** MultispeQ command result */
export interface MultispeqCommandResult<T = unknown> {
  data: T;
  checksum: string;
}

/** MultispeQ device info */
export interface MultispeqDeviceInfo {
  device_battery?: number;
  device_version?: string;
  device_id?: string;
  [key: string]: unknown;
}
