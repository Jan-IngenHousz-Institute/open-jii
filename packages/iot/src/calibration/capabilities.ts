/**
 * What a calibration definition may declare, derived from the registries that decide it.
 *
 * An author writing a procedure has to name instruments by the handshake they answer,
 * setpoints and readings the instrument actually has, and blocks the platform can write
 * back. None of that is guessable, and the last one fails silently: a block no writer
 * covers computes, passes review and is approved, and then never reaches the device.
 * Summarising the registries here lets the authoring surface offer them and check them.
 */
import type { SensorFamily } from "../core/families";
import type { InstrumentReading, InstrumentSetpoint } from "../instrument/interface";
import { BENCH_INSTRUMENTS } from "../instrument/registry";
import { DEVICE_SETPOINTS } from "../procedure/device-setpoints";
import { CALIBRATION_WRITERS } from "./write-back";

/** One piece of bench equipment a procedure can declare, as an author must refer to it. */
export interface BenchInstrumentSummary {
  model: string;
  /** What a declared `handshake` is matched against, case-insensitively. */
  identityToken: string;
  setpoints: readonly InstrumentSetpoint[];
  readings: readonly InstrumentReading[];
}

/** A setpoint on the device under test itself, which a family declares rather than an instrument. */
export interface DeviceSetpointSummary {
  name: string;
  unit: string;
  min: number;
  max: number;
  integer: boolean;
}

export interface FamilyCalibrationCapabilities {
  family: SensorFamily;
  deviceSetpoints: DeviceSetpointSummary[];
  /** Block name to the coefficients the platform has a console command for. */
  writableCoefficients: Record<string, string[]>;
}

export function benchInstrumentSummaries(): BenchInstrumentSummary[] {
  return BENCH_INSTRUMENTS.map((create) => {
    const instrument = create();
    return {
      model: instrument.model,
      identityToken: instrument.identityToken,
      setpoints: instrument.setpoints,
      readings: instrument.readings ?? [],
    };
  });
}

export function familyCalibrationCapabilities(family: SensorFamily): FamilyCalibrationCapabilities {
  const blocks = CALIBRATION_WRITERS[family]?.blocks;
  const writableCoefficients: Record<string, string[]> = {};
  for (const [block, writers] of Object.entries(blocks ?? {})) {
    writableCoefficients[block] = Object.keys(writers.coefficients);
  }

  return {
    family,
    deviceSetpoints: (DEVICE_SETPOINTS[family] ?? []).map((setpoint) => ({
      name: setpoint.name,
      unit: setpoint.unit,
      min: setpoint.min,
      max: setpoint.max,
      integer: setpoint.integer ?? false,
    })),
    writableCoefficients,
  };
}
