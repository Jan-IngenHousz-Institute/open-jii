/**
 * How approved coefficients reach a device, per family.
 *
 * A calibration block names coefficients by the keys a definition's output
 * schema declares (`par.slope`, `par.intercept`); the firmware wants console
 * commands. This is the one place that knows the mapping, and the one place
 * that knows how each family confirms a write: MiniPAR writers echo the value
 * back, so verification is reading the echo.
 *
 * Structural types rather than the contract's: this package has no
 * dependencies, and the calibration contract mirrors these shapes by hand.
 */
import type { SensorFamily } from "../core/families";
import type { IDeviceDriver } from "../driver/driver-base";
import { MINIPAR_COMMANDS } from "../driver/minipar/commands";

export type CoefficientValue = number | number[];

/** Blocks as an approved calibration carries them: only computed ones. */
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
  /** The console line for a value. */
  command: (value: number) => string;
  /** Whether the device's reply confirms the value it was sent. */
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

/**
 * Per-family writers, keyed by block then coefficient. A family absent here
 * cannot receive coefficients from the platform yet; Ambit joins once the
 * write-verify-restore loop over the boot dump is in place.
 */
export const CALIBRATION_WRITERS: Partial<Record<SensorFamily, FamilyCalibrationWriters>> = {
  minipar: {
    par: {
      slope: echoWriter(MINIPAR_COMMANDS.CAL_PAR_SLOPE),
      intercept: echoWriter(MINIPAR_COMMANDS.CAL_PAR_INTERCEPT),
    },
  },
};

/** Whether the platform can write a block of this shape to this family. */
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

/**
 * Write every coefficient of every block and report per block. A block is
 * verified only when each of its coefficients was confirmed; the first
 * failure is the block's error and the remaining coefficients of that block
 * are not attempted, so a half-written block is never reported as good.
 */
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
