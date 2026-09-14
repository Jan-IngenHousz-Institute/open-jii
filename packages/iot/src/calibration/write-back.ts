/**
 * How approved coefficients reach a device, per family: schema keys become console
 * commands, every write is checked against the device's reply, and a block the device
 * can read back is checked against what it holds afterwards.
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

/** A scalar goes in one command; an array goes one entry per command, paced. */
export type CoefficientWriter =
  | {
      kind: "scalar";
      command: (value: number) => string;
      verify: (reply: unknown, value: number) => boolean;
    }
  | {
      kind: "array";
      commandAt: (index: number, value: number) => string;
      verify: (reply: unknown, value: number) => boolean;
      pauseBetweenEntriesMs: number;
    };

/** What the device reports holding, keyed like the block's coefficients. */
export interface BlockReadback {
  command: string;
  parse: (reply: unknown) => Partial<Record<string, CoefficientValue>> | null;
}

export interface BlockWriters {
  coefficients: Partial<Record<string, CoefficientWriter>>;
  readback?: BlockReadback;
}

export interface FamilyCalibrationWriters {
  /** The gap the bench procedure leaves between consecutive console writes. */
  pauseBetweenWritesMs: number;
  blocks: Partial<Record<string, BlockWriters>>;
}

export interface WriteCalibrationOptions {
  /** Injected so tests do not wait out real pauses. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Six significant digits, as the firmware's calibration console expects. */
export function formatCoefficient(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

/** Equal to six significant digits, or to the six decimals the firmware prints small values with. */
function matchesWritten(reported: number, value: number): boolean {
  return Math.abs(reported - value) <= Math.abs(value) * 1e-5 + 5e-7;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replyText(reply: unknown): string {
  return typeof reply === "string" ? reply.trim() : typeof reply === "number" ? String(reply) : "";
}

function parseJsonRecord(reply: unknown): Record<string, unknown> | null {
  if (isRecord(reply)) return reply;
  try {
    const parsed: unknown = JSON.parse(replyText(reply));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The reply echoes the value. */
function verifyEcho(reply: unknown, value: number): boolean {
  const echoed = Number.parseFloat(replyText(reply));
  return Number.isFinite(echoed) && matchesWritten(echoed, value);
}

/** `{"spectrometer_coeff":{"channel":0,"value":0.007856}}`: the value as the firmware stored it. */
function verifySpectralEcho(reply: unknown, value: number): boolean {
  const inner = parseJsonRecord(reply)?.spectrometer_coeff;
  return isRecord(inner) && typeof inner.value === "number" && matchesWritten(inner.value, value);
}

/** `slope=0.960000,intercept=-1.080000` */
function parseKeyValues(reply: unknown): Partial<Record<string, CoefficientValue>> | null {
  const pairs = replyText(reply)
    .split(",")
    .map((pair) => pair.split("="))
    .filter((parts): parts is [string, string] => parts.length === 2);
  if (pairs.length === 0) return null;

  const parsed: Partial<Record<string, CoefficientValue>> = {};
  for (const [key, text] of pairs) {
    const number = Number.parseFloat(text.trim());
    if (!Number.isFinite(number)) return null;
    parsed[key.trim()] = number;
  }
  return parsed;
}

/** `0.007856,0.003438,...`: every channel the device holds. */
function parseCsvNumbers(reply: unknown): number[] | null {
  const numbers = replyText(reply)
    .split(",")
    .map((entry) => Number.parseFloat(entry.trim()));
  return numbers.length > 0 && numbers.every(Number.isFinite) ? numbers : null;
}

function scalarWriter(command: string): CoefficientWriter {
  return {
    kind: "scalar",
    command: (value) => `${command},${formatCoefficient(value)}`,
    verify: verifyEcho,
  };
}

/** A family absent here cannot receive coefficients yet; Ambit joins once its readback loop exists. */
export const CALIBRATION_WRITERS: Partial<Record<SensorFamily, FamilyCalibrationWriters>> = {
  minipar: {
    // The bench procedure waits 300 ms between the two PAR writes so the console keeps up.
    pauseBetweenWritesMs: 300,
    blocks: {
      par: {
        coefficients: {
          slope: scalarWriter(MINIPAR_COMMANDS.CAL_PAR_SLOPE),
          intercept: scalarWriter(MINIPAR_COMMANDS.CAL_PAR_INTERCEPT),
        },
        readback: { command: MINIPAR_COMMANDS.GET_CAL_PAR, parse: parseKeyValues },
      },
      spec: {
        coefficients: {
          channel_coefficients: {
            kind: "array",
            commandAt: (index, value) =>
              `${MINIPAR_COMMANDS.SET_SPEC_COEFF},${index},${formatCoefficient(value)}`,
            verify: verifySpectralEcho,
            pauseBetweenEntriesMs: 100,
          },
        },
        readback: {
          command: MINIPAR_COMMANDS.GET_SPEC_COEFF,
          parse: (reply) => {
            const channels = parseCsvNumbers(reply);
            return channels ? { channel_coefficients: channels } : null;
          },
        },
      },
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
    Object.keys(coefficients).every(
      (name) => writers.blocks[block]?.coefficients[name] !== undefined,
    ),
  );
}

/** Spaces every command in one session by the family's pause. */
class WritePacer {
  private sent = false;

  constructor(
    private readonly pauseMs: number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  async next(): Promise<void> {
    if (this.sent) await this.sleep(this.pauseMs);
    this.sent = true;
  }
}

/** A block is verified only when every coefficient was confirmed; the first failure stops the block. */
export async function writeCalibrationBlocks(
  driver: IDeviceDriver,
  family: SensorFamily,
  blocks: AppliedCalibrationBlocks,
  options: WriteCalibrationOptions = {},
): Promise<CalibrationWriteResults> {
  const writers = CALIBRATION_WRITERS[family];
  const sleep = options.sleep ?? realSleep;
  const results: CalibrationWriteResults = {};
  const pacer = new WritePacer(writers?.pauseBetweenWritesMs ?? 0, sleep);

  for (const [block, { coefficients }] of Object.entries(blocks)) {
    results[block] = writers
      ? await writeBlock(driver, writers, block, coefficients, pacer, sleep)
      : { verified: false, error: `The platform cannot write calibrations to a ${family} device` };
  }

  return results;
}

async function writeBlock(
  driver: IDeviceDriver,
  family: FamilyCalibrationWriters,
  block: string,
  coefficients: Record<string, CoefficientValue>,
  pacer: WritePacer,
  sleep: (ms: number) => Promise<void>,
): Promise<CoefficientWriteResult> {
  const writers = family.blocks[block];
  if (!writers) {
    return { verified: false, error: `No writers for block "${block}"` };
  }

  for (const [name, value] of Object.entries(coefficients)) {
    const writer = writers.coefficients[name];
    const label = `${block}.${name}`;
    if (!writer) {
      return { verified: false, error: `No writer for coefficient "${label}"` };
    }

    const failure =
      writer.kind === "scalar"
        ? await writeScalar(driver, writer, label, value, pacer)
        : await writeArray(driver, writer, label, value, pacer, sleep);
    if (failure) {
      return { verified: false, error: failure };
    }
  }

  if (writers.readback) {
    const disagreement = await readBack(driver, writers.readback, block, coefficients, pacer);
    if (disagreement) {
      return { verified: false, error: disagreement };
    }
  }

  return { verified: true };
}

async function writeScalar(
  driver: IDeviceDriver,
  writer: Extract<CoefficientWriter, { kind: "scalar" }>,
  label: string,
  value: CoefficientValue,
  pacer: WritePacer,
): Promise<string | null> {
  if (typeof value !== "number") {
    return `Coefficient "${label}" is not a scalar`;
  }
  await pacer.next();
  return sendAndVerify(driver, writer.command(value), writer.verify, label, value);
}

async function writeArray(
  driver: IDeviceDriver,
  writer: Extract<CoefficientWriter, { kind: "array" }>,
  label: string,
  value: CoefficientValue,
  pacer: WritePacer,
  sleep: (ms: number) => Promise<void>,
): Promise<string | null> {
  if (!Array.isArray(value)) {
    return `Coefficient "${label}" is not an array`;
  }
  await pacer.next();
  for (const [index, entry] of value.entries()) {
    if (index > 0) await sleep(writer.pauseBetweenEntriesMs);
    const failure = await sendAndVerify(
      driver,
      writer.commandAt(index, entry),
      writer.verify,
      `${label}[${index}]`,
      entry,
    );
    if (failure) return failure;
  }
  return null;
}

async function sendAndVerify(
  driver: IDeviceDriver,
  command: string,
  verify: (reply: unknown, value: number) => boolean,
  label: string,
  value: number,
): Promise<string | null> {
  const result = await driver.execute(command);
  if (!result.success) {
    return result.error?.message ?? `Writing "${label}" failed`;
  }
  if (!verify(result.data, value)) {
    return `Device did not confirm "${label}": replied ${JSON.stringify(result.data)}`;
  }
  return null;
}

/**
 * What the device holds after the writes. A firmware without the readback command
 * rejects it as unknown, and the echoes then stand on their own; any other failure,
 * an answer that cannot be read, or a disagreement leaves the block unverified.
 */
async function readBack(
  driver: IDeviceDriver,
  readback: BlockReadback,
  block: string,
  written: Record<string, CoefficientValue>,
  pacer: WritePacer,
): Promise<string | null> {
  await pacer.next();
  const result = await driver.execute(readback.command);
  if (!result.success) {
    const message = result.error?.message ?? `Reading back "${block}" failed`;
    return message.includes("unknown_command") ? null : message;
  }

  const reported = readback.parse(result.data);
  if (!reported) {
    return `Device readback for "${block}" could not be read: ${JSON.stringify(result.data)}`;
  }

  for (const [name, value] of Object.entries(written)) {
    const held = reported[name];
    const label = `${block}.${name}`;
    if (held === undefined) {
      return `Device readback for "${block}" does not report "${name}"`;
    }
    if (typeof value === "number") {
      if (typeof held !== "number" || !matchesWritten(held, value)) {
        return `Device holds ${JSON.stringify(held)} for "${label}" after writing ${formatCoefficient(value)}`;
      }
      continue;
    }
    // The device may hold more channels than were written; the written prefix must match.
    const matches =
      Array.isArray(held) &&
      held.length >= value.length &&
      value.every((entry, index) => matchesWritten(held[index], entry));
    if (!matches) {
      return `Device holds ${JSON.stringify(held)} for "${label}" after writing ${JSON.stringify(value)}`;
    }
  }
  return null;
}
