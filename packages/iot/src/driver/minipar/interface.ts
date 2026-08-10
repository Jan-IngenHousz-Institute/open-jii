import type { OpenJiiMeasurementEnvelope } from "../../utils/framing/openjii-envelope";

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
export type MiniParMeasurementEnvelope = OpenJiiMeasurementEnvelope;
