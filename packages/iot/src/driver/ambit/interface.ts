/** Events emitted by the Ambit driver */
export interface AmbitStreamEvents extends Record<string, unknown> {
  /** A reply finished collecting (quiet window elapsed). */
  receivedReply: string;
  bufferOverflow: { discardedBytes: number };
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
