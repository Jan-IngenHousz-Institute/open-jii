/** PAR reference on a MicroPython board: the automated rig's anchor, replacing the typed handheld reading. */
import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { defaultLogger } from "../../utils/logger/logger";
import type { BenchInstrument, InstrumentReading, InstrumentSetpoint } from "../interface";
import { findReading } from "../interface";
import { MICROPYTHON_COMMANDS, MICROPYTHON_IDENTITY_TOKEN } from "./commands";

export interface MicroPythonParConfig {
  identifyTimeoutMs?: number;
  readTimeoutMs?: number;
}

const DEFAULT_IDENTIFY_TIMEOUT_MS = 2_000;
const DEFAULT_READ_TIMEOUT_MS = 2_000;

/** A soft reboot's banner arrives in bursts; this much silence means it has finished. */
const REBOOT_QUIET_MS = 300;

export class MicroPythonParReference implements BenchInstrument {
  readonly model = "micropython-par-reference";
  readonly identityToken = MICROPYTHON_IDENTITY_TOKEN;
  readonly setpoints: readonly InstrumentSetpoint[] = [];
  readonly readings: readonly InstrumentReading[] = [{ name: "par", unit: "umol/m2/s" }];

  private transport: ITransportAdapter | undefined;
  private readonly log: Logger;
  private readonly identifyTimeoutMs: number;
  private readonly readTimeoutMs: number;
  private rxBuffer = "";
  private onChunk: (() => void) | undefined;

  constructor(config?: MicroPythonParConfig, logger?: Logger) {
    this.log = logger ?? defaultLogger;
    this.identifyTimeoutMs = config?.identifyTimeoutMs ?? DEFAULT_IDENTIFY_TIMEOUT_MS;
    this.readTimeoutMs = config?.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  }

  initialize(transport: ITransportAdapter): Promise<void> {
    this.transport = transport;
    this.rxBuffer = "";
    transport.onDataReceived((data) => {
      this.rxBuffer += data;
      if (this.rxBuffer.length > DEFAULT_MAX_BUFFER_SIZE) {
        this.log.error("MicroPython receive buffer exceeded max size, discarding data");
        this.rxBuffer = "";
        return;
      }
      this.onChunk?.();
    });
    return Promise.resolve();
  }

  async identify(): Promise<string> {
    const transport = this.requireTransport();
    this.rxBuffer = "";
    await transport.send(MICROPYTHON_COMMANDS.ENTER_RAW);
    const banner = await this.awaitLines(1, this.identifyTimeoutMs);

    // Leave raw mode whatever answered, so a foreign board is not left in a state its tooling does not expect.
    await transport.send(MICROPYTHON_COMMANDS.LEAVE_RAW_AND_REBOOT);
    // The reboot prints a banner of its own; the first read must not find it in the buffer.
    await this.awaitQuiet(REBOOT_QUIET_MS, this.identifyTimeoutMs);
    return banner[0];
  }

  applySetpoint(name: string, _value: number): Promise<void> {
    return Promise.reject(new Error(`MicroPython PAR reference has no setpoint "${name}"`));
  }

  async read(name: string, timeoutMs?: number): Promise<number> {
    if (!findReading(this, name)) {
      throw new Error(`MicroPython PAR reference has no reading "${name}"`);
    }
    const transport = this.requireTransport();
    this.rxBuffer = "";
    await transport.send(MICROPYTHON_COMMANDS.GET_PAR);

    // Line one is the REPL echoing the call; line two is the value.
    const [, valueLine] = await this.awaitLines(2, timeoutMs ?? this.readTimeoutMs);
    const value = Number.parseFloat(valueLine);
    if (!Number.isFinite(value)) {
      throw new Error(`MicroPython PAR reference answered "${valueLine}", not a number`);
    }
    return value;
  }

  /** Nothing to make safe: the reference sources no power. */
  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    this.transport = undefined;
    this.onChunk = undefined;
    this.rxBuffer = "";
    return Promise.resolve();
  }

  private requireTransport(): ITransportAdapter {
    if (!this.transport) {
      throw new Error("MicroPython PAR reference transport not initialized");
    }
    return this.transport;
  }

  /**
   * Resolve once `count` complete lines have arrived, returning them trimmed. The REPL
   * puts a line break in front of what it says, so leading breaks are not lines.
   */
  private awaitLines(count: number, timeoutMs: number): Promise<string[]> {
    const complete = () => this.pendingLines().length > count;
    if (complete()) return Promise.resolve(this.takeLines(count));

    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.onChunk = undefined;
        reject(new Error("MicroPython PAR reference did not answer"));
      }, timeoutMs);

      this.onChunk = () => {
        if (!complete()) return;
        clearTimeout(timer);
        this.onChunk = undefined;
        resolve(this.takeLines(count));
      };
    });
  }

  /**
   * Resolve once the board has said nothing for `quietMs`, or after `maxMs` regardless.
   * A soft reboot prints its banner over the next few hundred milliseconds, and the
   * first read would otherwise take that banner for its answer.
   */
  private awaitQuiet(quietMs: number, maxMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(quiet);
        clearTimeout(deadline);
        this.onChunk = undefined;
        this.rxBuffer = "";
        resolve();
      };
      let quiet = setTimeout(finish, quietMs);
      const deadline = setTimeout(finish, maxMs);

      this.onChunk = () => {
        clearTimeout(quiet);
        quiet = setTimeout(finish, quietMs);
      };
    });
  }

  private pendingLines(): string[] {
    return this.rxBuffer.replace(/^[\r\n]+/, "").split("\n");
  }

  private takeLines(count: number): string[] {
    const parts = this.pendingLines();
    const lines = parts.slice(0, count).map((line) => line.trim());
    this.rxBuffer = parts.slice(count).join("\n");
    return lines;
  }
}
