/**
 * How approved coefficients reach a device, per family: schema keys become console
 * commands and each write is verified by the device's reply.
 */
import type { SensorFamily } from "../core/families";
import type { IDeviceDriver } from "../driver/driver-base";
import { MINIPAR_COMMANDS } from "../driver/minipar/commands";

export type CoefficientValue = number | number[];

export type AppliedCalibrationBlocks = Record<
  string,
  { coefficients: Record<string, CoefficientValue> }
>;

export interface CoefficientWriteResult {
  verified: boolean;
  error?: string;
}

export type CalibrationWriteResults = Record<string, CoefficientWriteResult>;

export interface CoefficientWriter {
  command: (value: number) => string;
  verify: (reply: unknown, value: number) => boolean;
}

export type FamilyCalibrationWriters = Partial<
  Record<string, Partial<Record<string, CoefficientWriter>>>
>;

/** Six significant digits, as the firmware's calibration console expects. */
export function formatCoefficient(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

/** The reply echoes the value; equal to six significant digits is confirmed. */
function verifyEcho(reply: unknown, value: number): boolean {
  const text = typeof reply === "string" ? reply : typeof reply === "number" ? String(reply) : "";
  const echoed = Number.parseFloat(text.trim());
  if (!Number.isFinite(echoed)) return false;
  return Math.abs(echoed - value) <= Math.abs(value) * 1e-5 + 1e-9;
}

function echoWriter(command: string): CoefficientWriter {
  return {
    command: (value) => `${command},${formatCoefficient(value)}`,
    verify: verifyEcho,
  };
}

/** A family absent here cannot receive coefficients yet; Ambit joins once its readback loop exists. */
export const CALIBRATION_WRITERS: Partial<Record<SensorFamily, FamilyCalibrationWriters>> = {
  minipar: {
    par: {
      slope: echoWriter(MINIPAR_COMMANDS.CAL_PAR_SLOPE),
      intercept: echoWriter(MINIPAR_COMMANDS.CAL_PAR_INTERCEPT),
    },
  },
};

export function canWriteCalibration(
  family: SensorFamily,
  blocks: AppliedCalibrationBlocks,
): boolean {
  const writers = CALIBRATION_WRITERS[family];
  if (!writers) return false;
  return Object.entries(blocks).every(([block, { coefficients }]) =>
    Object.keys(coefficients).every((name) => writers[block]?.[name] !== undefined),
  );
}

/** A block is verified only when every coefficient was confirmed; the first failure stops the block. */
export async function writeCalibrationBlocks(
  driver: IDeviceDriver,
  family: SensorFamily,
  blocks: AppliedCalibrationBlocks,
): Promise<CalibrationWriteResults> {
  const writers = CALIBRATION_WRITERS[family];
  const results: CalibrationWriteResults = {};

  for (const [block, { coefficients }] of Object.entries(blocks)) {
    results[block] = writers
      ? await writeBlock(driver, writers, block, coefficients)
      : { verified: false, error: `The platform cannot write calibrations to a ${family} device` };
  }

  return results;
}

async function writeBlock(
  driver: IDeviceDriver,
  writers: FamilyCalibrationWriters,
  block: string,
  coefficients: Record<string, CoefficientValue>,
): Promise<CoefficientWriteResult> {
  for (const [name, value] of Object.entries(coefficients)) {
    const writer = writers[block]?.[name];
    if (!writer) {
      return { verified: false, error: `No writer for coefficient "${block}.${name}"` };
    }
    if (typeof value !== "number") {
      return { verified: false, error: `Coefficient "${block}.${name}" is not a scalar` };
    }

    const result = await driver.execute(writer.command(value));
    if (!result.success) {
      return {
        verified: false,
        error: result.error?.message ?? `Writing "${block}.${name}" failed`,
      };
    }
    if (!writer.verify(result.data, value)) {
      return {
        verified: false,
        error: `Device did not confirm "${block}.${name}": replied ${JSON.stringify(result.data)}`,
      };
    }
  }

  return { verified: true };
}
