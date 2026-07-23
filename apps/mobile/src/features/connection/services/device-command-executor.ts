import type { DeviceIdentity } from "@repo/iot";

/** Options shared by callers of any connected-device command executor. */
export interface DeviceCommandExecuteOptions {
  /** Override the response timeout (ms) for this command. */
  timeoutMs?: number;
  /**
   * Background/maintenance commands stay out of measurement-facing UI state.
   * Implementations may otherwise treat them like normal commands.
   */
  background?: boolean;
}

/** Transport-level progress for an in-flight device command. */
export interface DeviceCommandProgress {
  phase: "sent" | "receiving";
  chunks: number;
  bytes: number;
  elapsedMs: number;
  lastEventAt: number;
}

export type DeviceCommandProgressListener = (progress: DeviceCommandProgress) => void;

/** Device-level command boundary consumed by connection and measurement state. */
export interface DeviceCommandExecutor {
  execute(
    command: string | object,
    options?: DeviceCommandExecuteOptions,
  ): Promise<string | object>;
  cancel(): Promise<void>;
  /** Best-effort identification; callers must tolerate rejection. */
  getIdentity(): Promise<DeviceIdentity>;
  onProgress(listener: DeviceCommandProgressListener): () => void;
  destroy(): Promise<void>;
}
