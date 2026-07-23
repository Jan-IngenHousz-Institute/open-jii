/** Events emitted by the MiniPAR driver */
export interface MiniParStreamEvents extends Record<string, unknown> {
  /** A complete LINE-mode reply line. */
  receivedLine: string;
  /** A complete JSON-mode envelope (footer verified and stripped). */
  receivedEnvelope: MiniParMeasurementEnvelope;
  parseError: { line: string; error: unknown };
  bufferOverflow: { discardedBytes: number };
}

/** JSON-mode measurement envelope: `device_*` header fields plus a `sample` array. */
export interface MiniParMeasurementEnvelope {
  device_name?: string;
  device_version?: string;
  device_id?: string;
  device_battery?: string;
  device_firmware?: number | string;
  sample?: unknown[];
  [key: string]: unknown;
}
