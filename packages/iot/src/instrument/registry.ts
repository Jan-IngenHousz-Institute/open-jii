/** Matches a procedure's declared rig to what is plugged in, by identity reply. */
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import type { BenchInstrument } from "./interface";
import { identityMatches } from "./interface";
import { KiprimDcSource } from "./kiprim/instrument";
import { MicroPythonParReference } from "./micropython-par/instrument";

export type BenchInstrumentFactory = (logger?: Logger) => BenchInstrument;

/**
 * Probe order matters: the supply's *IDN? is harmless to a MicroPython prompt, whereas
 * Ctrl-A would drop a supply into whatever it makes of a control byte.
 */
export const BENCH_INSTRUMENTS: readonly BenchInstrumentFactory[] = [
  (logger) => new KiprimDcSource(undefined, logger),
  (logger) => new MicroPythonParReference(undefined, logger),
];

export interface BenchIdentification {
  instrument: BenchInstrument;

  /** What the port answered, so a caller can match a declared role's handshake against it. */
  reply: string;
}

/** Ask each known instrument in turn; null means nothing recognised the reply. */
export async function identifyBenchInstrument(
  transport: ITransportAdapter,
  logger?: Logger,
): Promise<BenchIdentification | null> {
  for (const create of BENCH_INSTRUMENTS) {
    const instrument = create(logger);
    try {
      await instrument.initialize(transport);
      const reply = await instrument.identify();
      if (identityMatches(instrument, reply)) {
        return { instrument, reply };
      }
    } catch {
      // A silent or malformed answer just means "not this one".
    }
    // Dropped, not destroyed: destroy() writes to the port, which no mismatched candidate may.
  }
  return null;
}

/** Resolve a declared handshake without touching hardware. */
export function benchInstrumentForHandshake(handshake: string): BenchInstrument | null {
  for (const create of BENCH_INSTRUMENTS) {
    const instrument = create();
    if (identityMatches(instrument, handshake)) {
      return instrument;
    }
  }
  return null;
}
