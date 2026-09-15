/** Reference sensor on a bench: this repo's minipar console, driven as rig equipment. */
import { MINIPAR_COMMANDS } from "../../driver/minipar/commands";
import { MINIPAR_FRAMING } from "../../driver/minipar/config";
import { MiniParDriver } from "../../driver/minipar/driver";
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { defaultLogger } from "../../utils/logger/logger";
import type { BenchInstrument, InstrumentReading, InstrumentSetpoint } from "../interface";
import { findReading } from "../interface";

export interface MiniParReferenceConfig {
  identifyTimeoutMs?: number;
  readTimeoutMs?: number;
}

const DEFAULT_IDENTIFY_TIMEOUT_MS = 3_000;

/** The product name every unit of this model prints for `hello`. */
export const MINIPAR_IDENTITY_TOKEN = "MiniPAR";

/** Joins the `hello` reply to the `get_name` reply, so one identity string carries both. */
export const MINIPAR_IDENTITY_SEPARATOR = " | ";

export class MiniParReference implements BenchInstrument {
  readonly model = "minipar-reference";
  readonly identityToken = MINIPAR_IDENTITY_TOKEN;
  readonly setpoints: readonly InstrumentSetpoint[] = [];

  readonly readings: readonly InstrumentReading[] = [
    { name: MINIPAR_COMMANDS.PAR, unit: "umol/m2/s" },
    { name: MINIPAR_COMMANDS.PAR_RAW, unit: "umol/m2/s" },
    { name: MINIPAR_COMMANDS.SPEC_RAW, unit: "counts" },
  ];

  /** Answers a channel CSV rather than one value, so its reply is kept as text. */
  private readonly spectralReadings: readonly string[] = [MINIPAR_COMMANDS.SPEC_RAW];

  private driver: MiniParDriver | undefined;
  private readonly log: Logger;
  private readonly identifyTimeoutMs: number;
  private readonly readTimeoutMs: number;

  constructor(config?: MiniParReferenceConfig, logger?: Logger) {
    this.log = logger ?? defaultLogger;
    this.identifyTimeoutMs = config?.identifyTimeoutMs ?? DEFAULT_IDENTIFY_TIMEOUT_MS;
    this.readTimeoutMs = config?.readTimeoutMs ?? MINIPAR_FRAMING.DEFAULT_TIMEOUT;
  }

  initialize(transport: ITransportAdapter): Promise<void> {
    const driver = new MiniParDriver(undefined, this.log);
    driver.initialize(transport);
    this.driver = driver;

    return Promise.resolve();
  }

  /**
   * Two units of this model sit on the bench and answer `hello` identically, so the
   * persisted name comes back in the same string: the class token matches the model,
   * a role's handshake matches the unit.
   */
  async identify(): Promise<string> {
    const hello = await this.run(MINIPAR_COMMANDS.HELLO, this.identifyTimeoutMs);
    const name = await this.run(MINIPAR_COMMANDS.GET_NAME, this.identifyTimeoutMs);

    return `${hello}${MINIPAR_IDENTITY_SEPARATOR}${name}`;
  }

  applySetpoint(name: string, _value: number): Promise<void> {
    return Promise.reject(new Error(`MiniPAR reference has no setpoint "${name}"`));
  }

  async read(name: string): Promise<number | string> {
    const reading = findReading(this, name);
    if (!reading) {
      throw new Error(`MiniPAR reference has no reading "${name}"`);
    }

    const text = await this.run(reading.name, this.readTimeoutMs);
    if (this.spectralReadings.includes(reading.name)) {
      return text;
    }

    const value = Number(text);
    // The anchor a fit is built on. Recording "NaN" or a truncated line as text would
    // carry a reference point the run has no reading for.
    if (text === "" || !Number.isFinite(value)) {
      throw new Error(`MiniPAR reference answered "${text}" to ${reading.name}, not a number`);
    }

    return value;
  }

  /** Nothing to make safe: the reference sources no power. */
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  async destroy(): Promise<void> {
    // The driver closes the port it was given. The rig releases that port straight
    // afterwards, and a throw here would report a wrong-unit port as a failure
    // rather than as the mismatch it is.
    await this.driver?.destroy().catch((error: unknown) => {
      this.log.error("MiniPAR reference could not be torn down", error);
    });
    this.driver = undefined;
  }

  private requireDriver(): MiniParDriver {
    if (!this.driver) {
      throw new Error("MiniPAR reference transport not initialized");
    }
    return this.driver;
  }

  private async run(command: string, timeoutMs: number): Promise<string> {
    const driver = this.requireDriver();
    const result = await driver.execute<string>(command, { timeoutMs });

    if (!result.success) {
      throw result.error ?? new Error(`MiniPAR reference refused "${command}"`);
    }
    if (typeof result.data !== "string") {
      throw new Error(`MiniPAR reference answered "${command}" with no text`);
    }

    return result.data;
  }
}
