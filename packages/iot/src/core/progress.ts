/**
 * Streaming progress of one in-flight device command. The shape mirrors the
 * mobile executor's progress events; the connector base class will emit it
 * natively (OJD-1668).
 */
export interface CommandProgress {
  phase: "sent" | "receiving";
  chunks: number;
  bytes: number;
  elapsedMs: number;
  lastEventAt: number;
}

export type CommandProgressListener = (progress: CommandProgress) => void;
