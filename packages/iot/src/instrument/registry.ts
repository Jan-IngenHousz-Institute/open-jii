/** Matches a procedure's declared rig to what is plugged in, by identity reply. */
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import type { BenchInstrument } from "./interface";
import { identityMatches } from "./interface";
import { KiprimDcSource } from "./kiprim/instrument";

export type BenchInstrumentFactory = (logger?: Logger) => BenchInstrument;

export const BENCH_INSTRUMENTS: readonly BenchInstrumentFactory[] = [
  (logger) => new KiprimDcSource(undefined, logger),
];

/** Ask each known instrument in turn; null means nothing recognised the reply. */
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
