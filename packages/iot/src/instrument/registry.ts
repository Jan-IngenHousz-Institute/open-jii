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
    try {
      await instrument.initialize(transport);
      const reply = await instrument.identify();
      if (identityMatches(instrument, reply)) {
        return { kind: "identified", instrument, reply };
      }

      const heard = reply.trim();
      if (heard !== "" && !replies.includes(heard)) {
        replies.push(heard);
      }
    } catch {
      // A silent or malformed answer just means "not this one".
    }
    // Dropped, not destroyed: destroy() writes to the port, which no mismatched candidate may.
  }
  return { kind: "unrecognised", replies };
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
