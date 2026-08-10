/** Events emitted by the Ambit driver */
export interface AmbitStreamEvents extends Record<string, unknown> {
  /** A reply finished collecting (quiet window elapsed). */
  receivedReply: string;
  /** A complete JSON-envelope reply (footer verified and stripped). */
  receivedEnvelope: AmbitMeasurementEnvelope;
  parseError: { line: string; error: unknown };
  bufferOverflow: { discardedBytes: number };
}

/**
 * JSON-envelope measurement reply (openjii_proto): `device_*` header fields
 * plus a `sample` array whose `set` carries one value per protocol command.
 */
export interface AmbitMeasurementEnvelope {
  device_name?: string;
  device_version?: string;
  device_battery?: number;
  device_firmware?: string;
  sample?: unknown[];
  [key: string]: unknown;
}

/** Parsed `get_par` / `PAR` reply. */
export interface AmbitParReading {
  par: number;
  /** 10 spectral channel counts. */
  channels: number[];
  [key: string]: unknown;
}

/** Parsed `temp` reply (MLX90632). */
export interface AmbitTempReading {
  objectC: number;
  ambientC: number;
  objectRawC: number;
  [key: string]: unknown;
}
