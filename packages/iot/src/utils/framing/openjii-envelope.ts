/**
 * Shared framing for the openJII serial protocol (`openjii_proto` firmware
 * module), spoken by every device embedding it (MiniPAR, Ambit): a protocol
 * JSON request is answered with one envelope of `device_*` header fields plus
 * a `sample` array, terminated by the constant `7A1E3AA1` footer (a fixed
 * sentinel, not a computed checksum). Top-level firmware errors (json_parse,
 * rx_overflow, json_timeout) are single JSON lines WITHOUT the footer.
 */
import { extractChecksum } from "./framing";

/** Constant sentinel closing every envelope reply, before the newline. */
export const OPENJII_FRAME_FOOTER = "7A1E3AA1";
export const OPENJII_FOOTER_LENGTH = OPENJII_FRAME_FOOTER.length;

/** Envelope reply: `device_*` header fields plus a `sample` array. */
export interface OpenJiiMeasurementEnvelope {
  device_name?: string;
  device_version?: string;
  device_id?: string;
  device_battery?: number | string;
  device_firmware?: number | string;
  sample?: unknown[];
  [key: string]: unknown;
}

/** Strip and verify the constant footer; null when the envelope is not complete yet. */
export function parseOpenJiiEnvelope(buffer: string): OpenJiiMeasurementEnvelope | null {
  const trimmed = buffer.trim();
  if (!trimmed.endsWith(OPENJII_FRAME_FOOTER)) return null;
  const { data } = extractChecksum(trimmed, OPENJII_FOOTER_LENGTH);
  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed !== null && typeof parsed === "object") {
      return parsed as OpenJiiMeasurementEnvelope;
    }
  } catch {
    // footer seen but JSON incomplete/corrupt; keep buffering
  }
  return null;
}

/**
 * First complete footer-less `{"error": ...}` line in the buffer, if any.
 * In-envelope errors (e.g. an error object inside `set`) are data, not
 * failures; this only matches the firmware's top-level error replies.
 */
export function parseOpenJiiTopLevelError(buffer: string): string | null {
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{"error"')) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        typeof (parsed as Record<string, unknown>).error === "string"
      ) {
        return (parsed as Record<string, unknown>).error as string;
      }
    } catch {
      // not a complete error line; keep buffering
    }
  }
  return null;
}

/** Hooks a driver exposes over its RX buffer so replies can be collected. */
export interface RxCollectorHooks {
  /** Current accumulated buffer. */
  read(): string;
  /** Take ownership of the buffer and clear it. */
  take(): string;
  /** Replace the single chunk listener (undefined to clear). */
  setOnChunk(cb: (() => void) | undefined): void;
}

export interface CollectReplyOptions {
  /** Resolves as soon as this returns true. */
  isComplete: (buffer: string) => boolean;
  /** Overall deadline. */
  timeoutMs: number;
  /** Optional RX quiet window that completes a reply carrying data. */
  quietMs?: number;
  /**
   * On deadline: reject outright (true), or resolve a non-empty partial
   * buffer and only reject when nothing arrived (default).
   */
  strictTimeout?: boolean;
}

/**
 * Collect one reply from an RX buffer: resolve when `isComplete`, when a
 * quiet window elapses with data (if `quietMs` is set), or per the timeout
 * policy. Rejects with "Response timeout" when nothing usable arrived.
 */
export function collectReply(rx: RxCollectorHooks, opts: CollectReplyOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let quietTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      cleanup();
      resolve(rx.take());
    };

    const overallTimer = setTimeout(() => {
      if (!opts.strictTimeout && rx.read().trim().length > 0) {
        finish();
        return;
      }
      cleanup();
      reject(new Error("Response timeout"));
    }, opts.timeoutMs);

    const cleanup = () => {
      clearTimeout(overallTimer);
      if (quietTimer) clearTimeout(quietTimer);
      rx.setOnChunk(undefined);
    };

    const check = () => {
      if (opts.isComplete(rx.read())) {
        finish();
        return;
      }
      if (opts.quietMs !== undefined) {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          if (rx.read().trim().length > 0) finish();
        }, opts.quietMs);
      }
    };

    rx.setOnChunk(check);
    check();
  });
}
