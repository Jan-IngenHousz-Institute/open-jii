/**
 * How approved coefficients reach a device, per family: schema keys become console
 * commands, every write is checked against the device's reply, and a block the device
 * can read back is checked against what it holds afterwards.
 */
import type { SensorFamily } from "../core/families";
import { AMBIT_BASELINE_SAVED, AMBIT_COMMANDS } from "../driver/ambit/commands";
import { parseAmbitBootDump } from "../driver/ambit/device-info";
import type { AmbitDeviceInfo } from "../driver/ambit/device-info";
import { BASELINE_CHANNELS, BASELINE_MAX_COUNT } from "../driver/ambit/response-parsers";
import type { CommandResult, IDeviceDriver } from "../driver/driver-base";
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

/** What a vector's entries must be for the firmware to take the command at all. */
export interface VectorEntryRange {
  count: number;
  min: number;
  max: number;
}

/**
 * A scalar goes in one command; an array goes one entry per command, paced; a vector
 * goes in one command carrying every value.
 */
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
    }
  | {
      kind: "vector";
      command: (values: number[]) => string;
      verify: (reply: unknown, values: number[]) => boolean;
      entries: VectorEntryRange;
    };

/** How far a readback may sit from what was written before the block counts as unverified. */
export interface ReadbackTolerance {
  relative: number;
  absolute: number;
}

/** Six significant digits, or the six decimals a console prints small values with. */
const DEFAULT_READBACK_TOLERANCE: ReadbackTolerance = { relative: 1e-5, absolute: 5e-7 };

/** The four decimals Ambit's gains go on the wire with. */
const AMBIT_READBACK_TOLERANCE: ReadbackTolerance = { relative: 1e-4, absolute: 5e-5 };

/** What the device reports holding, keyed like the block's coefficients. */
export interface BlockReadback {
  command: string;
  parse: (reply: unknown) => Partial<Record<string, CoefficientValue>> | null;
  /** Defaults to DEFAULT_READBACK_TOLERANCE. */
  tolerance?: ReadbackTolerance;
  /** One reply every block reads its own values out of: sent once, after all the writes. */
  shared?: boolean;
  /**
   * How a disagreement names what was written. It has to be the precision the wire
   * carried, or the message reads as a device fault when it is only rounding.
   */
  describeWritten?: (value: number) => string;
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

function matchesWritten(
  reported: number,
  value: number,
  tolerance = DEFAULT_READBACK_TOLERANCE,
): boolean {
  return Math.abs(reported - value) <= Math.abs(value) * tolerance.relative + tolerance.absolute;
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

/**
 * The PAR console echoes what it parsed at two decimals, while it stores and reads back
 * the full float. So the echo can only show the command was taken, to the precision it is
 * printed with; the block's readback is what proves the stored value. Comparing the echo
 * at full precision instead fails every fit whose third decimal is not zero.
 */
const PAR_ECHO_DECIMALS = 2;

function verifyEcho(reply: unknown, value: number): boolean {
  const echoed = Number.parseFloat(replyText(reply));
  const printedStep = 10 ** -PAR_ECHO_DECIMALS;
  return Number.isFinite(echoed) && Math.abs(echoed - value) <= printedStep / 2 + 1e-9;
}

/** `{"spectrometer_coeff":{"channel":0,"value":0.007856}}`: the value as the firmware stored it. */
function verifySpectralEcho(reply: unknown, value: number): boolean {
  const inner = parseJsonRecord(reply)?.spectrometer_coeff;
  return isRecord(inner) && typeof inner.value === "number" && matchesWritten(inner.value, value);
}

/** A writer the firmware answers nothing to: the driver reporting the write is the confirmation. */
function verifyAcknowledged(reply: unknown): boolean {
  return isRecord(reply) && typeof reply.acknowledged === "string";
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

function miniparScalarWriter(command: string): CoefficientWriter {
  return {
    kind: "scalar",
    command: (value) => `${command},${formatCoefficient(value)}`,
    verify: verifyEcho,
  };
}

/** Four decimals, behind the space these writers carry: `set_spec, 1.1893`. */
const ambitGainOnTheWire = (value: number): string => value.toFixed(4);

/** No reply at all, so the driver's own fire, settle and re-verify is the acknowledgement. */
function ambitGainWriter(command: string): CoefficientWriter {
  return {
    kind: "scalar",
    command: (value) => `${command}, ${ambitGainOnTheWire(value)}`,
    verify: verifyAcknowledged,
  };
}

/**
 * The boot dump is the only thing Ambit reads its stored coefficients back from, so
 * every block takes its own values out of one dump.
 */
function ambitBootDumpReadback(
  select: (info: AmbitDeviceInfo) => Partial<Record<string, CoefficientValue>>,
): BlockReadback {
  return {
    command: AMBIT_COMMANDS.REBOOT,
    shared: true,
    tolerance: AMBIT_READBACK_TOLERANCE,
    describeWritten: ambitGainOnTheWire,
    parse: (reply) => {
      const info = parseAmbitBootDump(replyText(reply));
      if (!info) {
        return null;
      }

      // A dump that stopped before the coefficient it is being read for leaves that field
      // absent, which is a readback nobody could take rather than a device holding zero.
      const selected = select(info);
      return Object.values(selected).every((value) => value === undefined) ? null : selected;
    },
  };
}

/** A family absent here cannot receive coefficients yet. */
export const CALIBRATION_WRITERS: Partial<Record<SensorFamily, FamilyCalibrationWriters>> = {
  minipar: {
    // The bench procedure waits 300 ms between the two PAR writes so the console keeps up.
    pauseBetweenWritesMs: 300,
    blocks: {
      par: {
        coefficients: {
          slope: miniparScalarWriter(MINIPAR_COMMANDS.CAL_PAR_SLOPE),
          intercept: miniparScalarWriter(MINIPAR_COMMANDS.CAL_PAR_INTERCEPT),
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
  ambit: {
    // The driver settles and re-verifies after every silent writer, which already spaces the console.
    pauseBetweenWritesMs: 0,
    blocks: {
      par: {
        coefficients: { spec: ambitGainWriter(AMBIT_COMMANDS.SET_SPEC) },
        readback: ambitBootDumpReadback((info) => ({ spec: info.lightSlope })),
      },
      led: {
        coefficients: { act: ambitGainWriter(AMBIT_COMMANDS.SET_ACT) },
        readback: ambitBootDumpReadback((info) => ({ act: info.actLedCoeff })),
      },
      baseline: {
        coefficients: {
          channels: {
            kind: "vector",
            command: (values) => `${AMBIT_COMMANDS.SET_BASELINE},${values.join(",")}`,
            verify: (reply) => replyText(reply) === AMBIT_BASELINE_SAVED,
            entries: { count: BASELINE_CHANNELS, min: 0, max: BASELINE_MAX_COUNT },
          },
        },
        readback: ambitBootDumpReadback((info) => ({ channels: info.adpdCalibration })),
      },
    },
  },
};

/** The blocks this family can write in full; the rest are recorded but never sent. */
export function writableCalibrationBlocks(
  family: SensorFamily,
  blocks: AppliedCalibrationBlocks,
): string[] {
  const writers = CALIBRATION_WRITERS[family];
  if (!writers) return [];
  return Object.entries(blocks)
    .filter(([block, { coefficients }]) =>
      Object.keys(coefficients).every(
        (name) => writers.blocks[block]?.coefficients[name] !== undefined,
      ),
    )
    .map(([block]) => block);
}

/**
 * Whether anything at all can reach the device.
 *
 * Deliberately not "every block": a device whose vendor tool owns one coefficient would
 * otherwise have its entire calibration recorded and never written, under a message that
 * reads like the family is unsupported. Blocks without writers are reported unwritten,
 * one by one, by the write itself.
 */
export function canWriteCalibration(
  family: SensorFamily,
  blocks: AppliedCalibrationBlocks,
): boolean {
  return writableCalibrationBlocks(family, blocks).length > 0;
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

/** A block waiting on the reply its whole family reads back from. */
interface PendingReadback {
  block: string;
  readback: BlockReadback;
  written: Record<string, CoefficientValue>;
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
  const pending: PendingReadback[] = [];

  for (const [block, { coefficients }] of Object.entries(blocks)) {
    results[block] = writers
      ? await writeBlock(driver, writers, block, coefficients, pacer, sleep, pending)
      : { verified: false, error: `The platform cannot write calibrations to a ${family} device` };
  }

  for (const [block, error] of await readBackShared(driver, pending, pacer)) {
    results[block] = { verified: false, error };
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
  pending: PendingReadback[],
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

    const failure = await writeCoefficient(driver, writer, label, value, pacer, sleep);
    if (failure) {
      return { verified: false, error: failure };
    }
  }

  const readback = writers.readback;
  if (readback?.shared) {
    // The shared reply is read once the whole session is written; it downgrades this there.
    pending.push({ block, readback, written: coefficients });
    return { verified: true };
  }

  if (readback) {
    const result = await sendReadback(driver, readback.command, pacer);
    const disagreement = checkReadback(result, readback, block, coefficients);
    if (disagreement) {
      return { verified: false, error: disagreement };
    }
  }

  return { verified: true };
}

function writeCoefficient(
  driver: IDeviceDriver,
  writer: CoefficientWriter,
  label: string,
  value: CoefficientValue,
  pacer: WritePacer,
  sleep: (ms: number) => Promise<void>,
): Promise<string | null> {
  switch (writer.kind) {
    case "scalar":
      return writeScalar(driver, writer, label, value, pacer);
    case "array":
      return writeArray(driver, writer, label, value, pacer, sleep);
    case "vector":
      return writeVector(driver, writer, label, value, pacer);
  }
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
  return sendAndVerify(
    driver,
    writer.command(value),
    (reply) => writer.verify(reply, value),
    label,
  );
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
      (reply) => writer.verify(reply, entry),
      `${label}[${index}]`,
    );
    if (failure) return failure;
  }
  return null;
}

/** One command carries the whole vector, so a value the firmware cannot take is refused first. */
async function writeVector(
  driver: IDeviceDriver,
  writer: Extract<CoefficientWriter, { kind: "vector" }>,
  label: string,
  value: CoefficientValue,
  pacer: WritePacer,
): Promise<string | null> {
  if (!Array.isArray(value)) {
    return `Coefficient "${label}" is not an array`;
  }

  const refusal = outsideEntryRange(writer.entries, value);
  if (refusal) {
    return `Coefficient "${label}" ${refusal}`;
  }

  await pacer.next();
  return sendAndVerify(
    driver,
    writer.command(value),
    (reply) => writer.verify(reply, value),
    label,
  );
}

/** Why these entries would not reach the wire, or null. */
function outsideEntryRange(entries: VectorEntryRange, values: number[]): string | null {
  if (values.length !== entries.count) {
    return `needs ${entries.count} values, not ${values.length}`;
  }

  const withinRange = values.every(
    (entry) => Number.isInteger(entry) && entry >= entries.min && entry <= entries.max,
  );
  return withinRange ? null : `needs whole numbers in [${entries.min}, ${entries.max}]`;
}

async function sendAndVerify(
  driver: IDeviceDriver,
  command: string,
  verify: (reply: unknown) => boolean,
  label: string,
): Promise<string | null> {
  const result = await driver.execute(command);
  if (!result.success) {
    return result.error?.message ?? `Writing "${label}" failed`;
  }
  if (!verify(result.data)) {
    return `Device did not confirm "${label}": replied ${JSON.stringify(result.data)}`;
  }
  return null;
}

async function sendReadback(
  driver: IDeviceDriver,
  command: string,
  pacer: WritePacer,
): Promise<CommandResult<unknown>> {
  await pacer.next();
  return driver.execute(command);
}

/**
 * Blocks whose values all come out of one reply, Ambit's boot dump among them: the
 * command runs once per session, after every block has been written, and each block
 * reads its own coefficients out of the same answer. Only the disagreements come back.
 */
async function readBackShared(
  driver: IDeviceDriver,
  pending: PendingReadback[],
  pacer: WritePacer,
): Promise<Map<string, string>> {
  const replies = new Map<string, CommandResult<unknown>>();
  const failures = new Map<string, string>();

  for (const { block, readback, written } of pending) {
    let reply = replies.get(readback.command);
    if (!reply) {
      reply = await sendReadback(driver, readback.command, pacer);
      replies.set(readback.command, reply);
    }

    const disagreement = checkReadback(reply, readback, block, written);
    if (disagreement) {
      failures.set(block, disagreement);
    }
  }

  return failures;
}

/**
 * What the device holds after the writes. A firmware without the readback command
 * rejects it as unknown, and the echoes then stand on their own; any other failure,
 * an answer that cannot be read, or a disagreement leaves the block unverified.
 */
function checkReadback(
  result: CommandResult<unknown>,
  readback: BlockReadback,
  block: string,
  written: Record<string, CoefficientValue>,
): string | null {
  if (!result.success) {
    const message = result.error?.message ?? `Reading back "${block}" failed`;
    return message.includes("unknown_command") ? null : message;
  }

  const reported = readback.parse(result.data);
  if (!reported) {
    return `Device readback for "${block}" could not be read: ${JSON.stringify(result.data)}`;
  }

  const tolerance = readback.tolerance ?? DEFAULT_READBACK_TOLERANCE;
  const describe = readback.describeWritten ?? formatCoefficient;

  for (const [name, value] of Object.entries(written)) {
    const held = reported[name];
    const label = `${block}.${name}`;
    if (held === undefined) {
      return `Device readback for "${block}" does not report "${name}"`;
    }
    if (typeof value === "number") {
      if (typeof held !== "number" || !matchesWritten(held, value, tolerance)) {
        return `Device holds ${JSON.stringify(held)} for "${label}" after writing ${describe(value)}`;
      }
      continue;
    }
    // The device may hold more channels than were written; the written prefix must match.
    const matches =
      Array.isArray(held) &&
      held.length >= value.length &&
      value.every((entry, index) => matchesWritten(held[index], entry, tolerance));
    if (!matches) {
      return `Device holds ${JSON.stringify(held)} for "${label}" after writing ${JSON.stringify(value)}`;
    }
  }
  return null;
}
