/**
 * Which bench instruments the platform can drive, and how a procedure's
 * declared rig is matched to what is actually plugged in.
 *
 * A calibration procedure names auxiliary instruments by the reply their
 * identity query returns (`handshake: "KIPRIM"`). Discovery is therefore
 * "ask every candidate on this port who it is, and see whose token matches".
 */
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import type { BenchInstrument } from "./interface";
import { identityMatches } from "./interface";
import { KiprimDcSource } from "./kiprim/instrument";

export type BenchInstrumentFactory = (logger?: Logger) => BenchInstrument;

/** Every bench instrument the platform knows how to drive. */
export const BENCH_INSTRUMENTS: readonly BenchInstrumentFactory[] = [
  (logger) => new KiprimDcSource(undefined, logger),
];

/**
 * Identify whatever is on a transport by asking each known instrument in turn.
 * Returns the initialized instrument, or null when nothing recognises the
 * reply, which a wizard reports as "unknown instrument on this port" rather
 * than guessing.
 */
export async function identifyBenchInstrument(
  transport: ITransportAdapter,
  logger?: Logger,
): Promise<BenchInstrument | null> {
  for (const create of BENCH_INSTRUMENTS) {
    const instrument = create(logger);
    try {
      await instrument.initialize(transport);
      const reply = await instrument.identify();
      if (identityMatches(instrument, reply)) {
        return instrument;
      }
    } catch {
      // A silent or malformed answer just means "not this one".
    }
    await instrument.destroy().catch(() => undefined);
  }
  return null;
}

/**
 * The instrument a procedure's declared handshake refers to, without touching
 * hardware. Lets a definition editor tell an author that a handshake matches
 * nothing the platform can drive.
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
