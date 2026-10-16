/** Matches a procedure's declared rig to what is plugged in, by identity reply. */
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import { CalitoolSpectralBoard } from "./calitool/instrument";
import type { BenchInstrument } from "./interface";
import { identityMatches } from "./interface";
import { KiprimDcSource } from "./kiprim/instrument";
import { MicroPythonParReference } from "./micropython-par/instrument";
import { MiniParReference } from "./minipar-reference/instrument";

export type BenchInstrumentFactory = (logger?: Logger) => BenchInstrument;

/**
 * What one candidate may spend naming itself. A port is asked by every candidate in
 * turn, so a working instrument's own timeout would make discovery cost the sum of
 * them; a board on the other end of a cable answers in well under this.
 */
export const BENCH_PROBE_TIMEOUT_MS = 1_000;

/**
 * Probe order matters, and the MicroPython prompt stays last: its Ctrl-A would drop any
 * other instrument into whatever it makes of a control byte, and on a board that does
 * not answer it the recovery byte is never sent. Every probe ahead of it is plain text
 * that an instrument which does not know it answers with an error line.
 */
export const BENCH_INSTRUMENTS: readonly BenchInstrumentFactory[] = [
  (logger) => new KiprimDcSource({ identifyTimeoutMs: BENCH_PROBE_TIMEOUT_MS }, logger),
  (logger) => new CalitoolSpectralBoard({ identifyTimeoutMs: BENCH_PROBE_TIMEOUT_MS }, logger),
  (logger) => new MiniParReference({ identifyTimeoutMs: BENCH_PROBE_TIMEOUT_MS }, logger),
  (logger) => new MicroPythonParReference({ identifyTimeoutMs: BENCH_PROBE_TIMEOUT_MS }, logger),
];

export interface BenchIdentification {
  kind: "identified";
  instrument: BenchInstrument;

  /** What the port answered, so a caller can match a declared role's handshake against it. */
  reply: string;
}

export interface BenchUnrecognised {
  kind: "unrecognised";

  /**
   * What the port answered the candidates' probes, so an operator can see what is
   * plugged in instead. Empty when the port stayed silent.
   */
  replies: string[];
}

/**
 * Ask each known instrument in turn, stopping at the first that recognises its reply.
 *
 * Every candidate writes to the same port, so an identity probe has to end its line in
 * a way any of these consoles will accept. One that left a partial command behind would
 * have the next candidate's probe read fused onto it.
 */
export async function identifyBenchInstrument(
  transport: ITransportAdapter,
  logger?: Logger,
): Promise<BenchIdentification | BenchUnrecognised> {
  const replies: string[] = [];

  for (const create of BENCH_INSTRUMENTS) {
    const instrument = create(logger);
    const probe = new ProbeRecorder(transport);
    try {
      await instrument.initialize(probe);
      const reply = await instrument.identify();
      if (identityMatches(instrument, reply)) {
        probe.stop();
        return { kind: "identified", instrument, reply };
      }
    } catch {
      // A silent or malformed answer just means "not this one".
    }

    // What the port said rather than what the candidate made of it: a candidate may read one
    // line of several, or fail at its second command after the port answered its first.
    for (const line of probe.stop()) {
      if (!replies.includes(line)) {
        replies.push(line);
      }
    }
    // Dropped, not destroyed: destroy() writes to the port, which no mismatched candidate may.
  }
  return { kind: "unrecognised", replies };
}

/** Enough for any identity banner, and a cap on a port that streams while it is probed. */
const MAX_PROBE_TRANSCRIPT = 2_000;

/**
 * Hands a candidate the port and keeps what the port sends while it probes, so a probe
 * that fails at its second command still shows the answer to its first. An identified
 * instrument goes on using this transport, so recording ends with the probe.
 */
class ProbeRecorder implements ITransportAdapter {
  private heard = "";
  private isRecording = true;

  constructor(private readonly transport: ITransportAdapter) {}

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  send(data: string): Promise<void> {
    return this.transport.send(data);
  }

  onDataReceived(callback: (data: string) => void): void {
    this.transport.onDataReceived((data) => {
      if (this.isRecording) {
        this.heard = (this.heard + data).slice(0, MAX_PROBE_TRANSCRIPT);
      }
      callback(data);
    });
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.transport.onStatusChanged(callback);
  }

  disconnect(): Promise<void> {
    return this.transport.disconnect();
  }

  /** Ends recording and returns the lines heard, trimmed, without blank ones. */
  stop(): string[] {
    this.isRecording = false;
    return this.heard
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }
}

/**
 * Resolve a declared handshake without touching hardware. It answers for a handshake
 * that names a model. A bench that tells two units of one model apart by the name each
 * was given answers only at the port, so a handshake naming a unit resolves to null.
 */
export function benchInstrumentForHandshake(handshake: string): BenchInstrument | null {
  for (const create of BENCH_INSTRUMENTS) {
    const instrument = create();
    if (identityMatches(instrument, handshake)) {
      return instrument;
    }
  }
  return null;
}
