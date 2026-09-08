/**
 * Bench instruments: rig equipment a procedure drives but never measures with.
 * Deliberately not a SensorFamily: nothing here is registered, bound to an experiment, or ingested.
 */
import type { ITransportAdapter } from "../transport/interface";

export interface InstrumentSetpoint {
  readonly name: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
}

export interface BenchInstrument {
  readonly model: string;

  /** Substring the procedure's handshake must match in the identity reply, compared case-insensitively. */
  readonly identityToken: string;

  readonly setpoints: readonly InstrumentSetpoint[];

  initialize(transport: ITransportAdapter): Promise<void>;

  identify(): Promise<string>;

  applySetpoint(name: string, value: number): Promise<void>;

  /** Return to a state safe to walk away from: a lamp left at 6.6 A after an aborted sweep is a hazard. */
  shutdown(): Promise<void>;

  destroy(): Promise<void>;
}

export function identityMatches(instrument: BenchInstrument, reply: string): boolean {
  return reply.toUpperCase().includes(instrument.identityToken.toUpperCase());
}

export function findSetpoint(
  instrument: BenchInstrument,
  name: string,
): InstrumentSetpoint | undefined {
  return instrument.setpoints.find((setpoint) => setpoint.name === name);
}
