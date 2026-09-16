/**
 * Bench instruments: rig equipment a procedure drives but never measures with.
 * Deliberately not a SensorFamily: nothing here is registered, bound to an experiment, or ingested.
 */
import type { ITransportAdapter } from "../transport/interface";

export interface InstrumentReading {
  readonly name: string;
  readonly unit: string;
}

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

  /**
   * A reference sensor is bench equipment, not a registered device: nothing it reads is
   * ingested. Absent on instruments that only apply setpoints.
   */
  readonly readings?: readonly InstrumentReading[];

  initialize(transport: ITransportAdapter): Promise<void>;

  identify(): Promise<string>;

  applySetpoint(name: string, value: number): Promise<void>;

  /**
   * Take one reading by name. Present exactly when `readings` is. A procedure may declare
   * a longer wait than the instrument's own default for a reading that takes its time.
   */
  read?(name: string, timeoutMs?: number): Promise<number | string>;

  /** Return to a state safe to walk away from: a lamp left at 6.6 A after an aborted sweep is a hazard. */
  shutdown(): Promise<void>;

  destroy(): Promise<void>;
}

/** A declared handshake matches an identity reply when it appears in it, ignoring case. */
export function handshakeMatches(reply: string, handshake: string): boolean {
  return reply.trim().toUpperCase().includes(handshake.trim().toUpperCase());
}

export function identityMatches(instrument: BenchInstrument, reply: string): boolean {
  return handshakeMatches(reply, instrument.identityToken);
}

export function findSetpoint(
  instrument: BenchInstrument,
  name: string,
): InstrumentSetpoint | undefined {
  return instrument.setpoints.find((setpoint) => setpoint.name === name);
}

export function findReading(
  instrument: BenchInstrument,
  name: string,
): InstrumentReading | undefined {
  return instrument.readings?.find((reading) => reading.name === name);
}
