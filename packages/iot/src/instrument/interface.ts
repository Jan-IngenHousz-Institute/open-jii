/**
 * Bench instruments: rig equipment that a calibration procedure drives but
 * never measures with.
 *
 * Deliberately not a `SensorFamily`. That taxonomy describes devices the
 * platform registers, binds to experiments, and ingests measurements from, and
 * it flows into the API contract and the MQTT topic. A DC power source does
 * none of that: it takes setpoints and answers nothing worth storing. Adding
 * it to the family enum would put lab furniture in the device registry.
 *
 * A calibration procedure's stimulus names an instrument role and a setpoint
 * (`{ instrument: "lamp", set: "current_a" }`); this is the contract that turns
 * that pair into wire traffic.
 */
import type { ITransportAdapter } from "../transport/interface";

/** A setpoint an instrument accepts, and the unit its value is expressed in. */
export interface InstrumentSetpoint {
  /** Name a procedure uses in `stimulus.set`, e.g. "current_a". */
  readonly name: string;
  /** Human-facing unit for prompts and review, e.g. "A". */
  readonly unit: string;
  readonly min: number;
  readonly max: number;
}

export interface BenchInstrument {
  /** Stable model key, e.g. "kiprim-dc". */
  readonly model: string;

  /**
   * Substring a procedure's `handshake` must match against this instrument's
   * identity reply, e.g. "KIPRIM". Discovery compares case-insensitively
   * because the reply carries vendor formatting the procedure should not have
   * to reproduce exactly.
   */
  readonly identityToken: string;

  readonly setpoints: readonly InstrumentSetpoint[];

  initialize(transport: ITransportAdapter): Promise<void>;

  /** Raw identity reply, used to confirm the right box is on the port. */
  identify(): Promise<string>;

  /** Apply one setpoint. Rejects an unknown name or an out-of-range value. */
  applySetpoint(name: string, value: number): Promise<void>;

  /**
   * Return the instrument to a state that is safe to walk away from. A lamp
   * left at 6.6 A after an aborted sweep is a hazard, so every procedure run
   * ends here whether or not it succeeded.
   */
  shutdown(): Promise<void>;

  destroy(): Promise<void>;
}

/** Whether an identity reply belongs to this instrument. */
export function identityMatches(instrument: BenchInstrument, reply: string): boolean {
  return reply.toUpperCase().includes(instrument.identityToken.toUpperCase());
}

/** The setpoint definition for a name, or undefined when unsupported. */
export function findSetpoint(
  instrument: BenchInstrument,
  name: string,
): InstrumentSetpoint | undefined {
  return instrument.setpoints.find((setpoint) => setpoint.name === name);
}
