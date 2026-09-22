/** Spectral tool board: drives one LED and reads the twelve channels an LED calibration measures against. */
import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { defaultLogger } from "../../utils/logger/logger";
import type { BenchInstrument, InstrumentReading, InstrumentSetpoint } from "../interface";
import { handshakeMatches } from "../interface";
import {
  CALITOOL_ACK,
  CALITOOL_COMMANDS,
  CALITOOL_IDENTITY_LINES,
  CALITOOL_IDENTITY_TOKEN,
  CALITOOL_LIMITS,
} from "./commands";

export interface CalitoolConfig {
  identifyTimeoutMs?: number;

  /** How long the greeting is given to finish once its first line has landed. */
  settleTimeoutMs?: number;

  replyTimeoutMs?: number;
}

const DEFAULT_IDENTIFY_TIMEOUT_MS = 2_000;
const DEFAULT_SETTLE_TIMEOUT_MS = 250;
const DEFAULT_REPLY_TIMEOUT_MS = 2_000;

interface CalitoolSetpoint extends InstrumentSetpoint {
  readonly write: (count: number) => string;
}

interface CalitoolReading extends InstrumentReading {
  readonly channel: number;
}

const CALITOOL_SETPOINTS: readonly CalitoolSetpoint[] = [
  {
    name: "led_ma",
    unit: "mA",
    min: 0,
    max: CALITOOL_LIMITS.LED_MAX_MA,
    write: CALITOOL_COMMANDS.setLed,
  },
  {
    name: "gain",
    unit: "step",
    min: 0,
    max: CALITOOL_LIMITS.GAIN_MAX,
    write: CALITOOL_COMMANDS.setGain,
  },
  {
    name: "atime",
    unit: "count",
    min: CALITOOL_LIMITS.ATIME_MIN,
    max: CALITOOL_LIMITS.ATIME_MAX,
    write: CALITOOL_COMMANDS.setAtime,
  },
  {
    name: "astep",
    unit: "count",
    min: CALITOOL_LIMITS.ASTEP_MIN,
    max: CALITOOL_LIMITS.ASTEP_MAX,
    write: CALITOOL_COMMANDS.setAstep,
  },
];

const CALITOOL_READINGS: readonly CalitoolReading[] = Array.from(
  { length: CALITOOL_LIMITS.CHANNEL_COUNT },
  (_, channel) => ({ name: `channel_${channel}`, unit: "count", channel }),
);

export class CalitoolSpectralBoard implements BenchInstrument {
  readonly model = "calitool-spectral-board";
  readonly identityToken = CALITOOL_IDENTITY_TOKEN;
  readonly setpoints: readonly InstrumentSetpoint[] = CALITOOL_SETPOINTS;
  readonly readings: readonly InstrumentReading[] = CALITOOL_READINGS;

  private transport: ITransportAdapter | undefined;
  private readonly log: Logger;
  private readonly identifyTimeoutMs: number;
  private readonly settleTimeoutMs: number;
  private readonly replyTimeoutMs: number;
  private rxBuffer = "";
  private onChunk: (() => void) | undefined;

  constructor(config?: CalitoolConfig, logger?: Logger) {
    this.log = logger ?? defaultLogger;
    this.identifyTimeoutMs = config?.identifyTimeoutMs ?? DEFAULT_IDENTIFY_TIMEOUT_MS;
    this.settleTimeoutMs = config?.settleTimeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
    this.replyTimeoutMs = config?.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  }

  initialize(transport: ITransportAdapter): Promise<void> {
    this.transport = transport;
    this.rxBuffer = "";
    transport.onDataReceived((data) => {
      this.rxBuffer += data;
      if (this.rxBuffer.length > DEFAULT_MAX_BUFFER_SIZE) {
        this.log.error("Spectral tool board receive buffer exceeded max size, discarding data");
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
    await transport.send(CALITOOL_COMMANDS.IDENTIFY);

    const greeting = await this.awaitGreeting();
    const identity = greeting.find((line) => handshakeMatches(line, this.identityToken));

    // A foreign banner is still returned: the caller decides what answered, not this class.
    return identity ?? greeting.join(" ");
  }

  async applySetpoint(name: string, value: number): Promise<void> {
    const setpoint = this.findWritableSetpoint(name);
    if (!setpoint) {
      throw new Error(`Spectral tool board has no setpoint "${name}"`);
    }

    // Every setpoint is a register count, so a fraction is refused rather than rounded into a silent lie.
    if (!Number.isInteger(value)) {
      throw new Error(`Setpoint ${name} must be a whole number, not ${value}`);
    }

    if (value < setpoint.min || value > setpoint.max) {
      throw new Error(
        `Setpoint ${name} must be between ${setpoint.min} and ${setpoint.max} ${setpoint.unit}`,
      );
    }

    const transport = this.requireTransport();
    this.rxBuffer = "";
    await transport.send(setpoint.write(value));
    await this.expectAck(name);
  }

  async read(name: string, timeoutMs?: number): Promise<number> {
    const reading = this.findChannelReading(name);
    if (!reading) {
      throw new Error(`Spectral tool board has no reading "${name}"`);
    }

    const transport = this.requireTransport();
    this.rxBuffer = "";
    // The integration is what takes time, and it is what the caller's timeout is for; a
    // long atime and astep run it past the default while the channel read stays instant.
    await transport.send(CALITOOL_COMMANDS.MEASURE);
    await this.expectAck("measure", timeoutMs ?? this.replyTimeoutMs);

    await transport.send(CALITOOL_COMMANDS.getChannel(reading.channel));
    const answer = await this.awaitLine(this.replyTimeoutMs);
    return this.parseChannelValue(answer);
  }

  /** Darken the board: an LED left driving both heats and biases whatever is under it. */
  async shutdown(): Promise<void> {
    if (!this.transport) {
      return;
    }

    try {
      this.rxBuffer = "";
      await this.transport.send(CALITOOL_COMMANDS.setLed(0));
      // Read like every other write. Unread, the board's answer would be waiting in the
      // buffer to be taken for the next command's, and a refusal would pass unnoticed.
      await this.expectAck("setled 0");
    } catch (error) {
      this.log.error("Spectral tool board could not be darkened", error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    await this.shutdown().catch(() => undefined);
    this.transport = undefined;
    this.onChunk = undefined;
    this.rxBuffer = "";
  }

  private requireTransport(): ITransportAdapter {
    if (!this.transport) {
      throw new Error("Spectral tool board transport not initialized");
    }
    return this.transport;
  }

  private findWritableSetpoint(name: string): CalitoolSetpoint | undefined {
    return CALITOOL_SETPOINTS.find((setpoint) => setpoint.name === name);
  }

  private findChannelReading(name: string): CalitoolReading | undefined {
    return CALITOOL_READINGS.find((reading) => reading.name === name);
  }

  /**
   * The greeting runs to three lines with no terminator of its own, and the identity is
   * not always the first. Reading stops at the line that carries it, so a board that
   * names itself straight away does not cost two settle windows on every port probed.
   */
  private async awaitGreeting(): Promise<string[]> {
    const lines: string[] = [];

    while (lines.length < CALITOOL_IDENTITY_LINES) {
      const isFirstLine = lines.length === 0;
      const line = await this.nextLine(isFirstLine ? this.identifyTimeoutMs : this.settleTimeoutMs);
      if (line === undefined) {
        break;
      }

      lines.push(line);
      if (line.toUpperCase().includes(CALITOOL_IDENTITY_TOKEN.toUpperCase())) {
        break;
      }
    }

    this.rxBuffer = "";
    if (lines.length === 0) {
      throw new Error("Spectral tool board did not answer");
    }

    return lines;
  }

  private async expectAck(what: string, timeoutMs = this.replyTimeoutMs): Promise<void> {
    const line = await this.awaitLine(timeoutMs);

    // Not a substring match: "LOOKUP" contains the acknowledgement and an error line must not pass.
    if (!line.toUpperCase().startsWith(CALITOOL_ACK)) {
      throw new Error(`Spectral tool board answered "${line}" to ${what}, not ${CALITOOL_ACK}`);
    }
  }

  private parseChannelValue(line: string): number {
    const colon = line.indexOf(":");
    if (colon < 0) {
      throw new Error(
        `Spectral tool board answered "${line}", which carries no value after a colon`,
      );
    }

    const value = Number.parseInt(line.slice(colon + 1).trim(), 10);
    if (!Number.isFinite(value)) {
      throw new Error(`Spectral tool board answered "${line}", not a channel count`);
    }

    return value;
  }

  private async awaitLine(timeoutMs: number): Promise<string> {
    const line = await this.nextLine(timeoutMs);
    if (line === undefined) {
      throw new Error("Spectral tool board did not answer");
    }

    return line;
  }

  /** Resolves undefined when the window closes, so a caller can treat silence as the end. */
  private nextLine(timeoutMs: number): Promise<string | undefined> {
    const buffered = this.takeLine();
    if (buffered !== undefined) {
      return Promise.resolve(buffered);
    }

    return new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => {
        this.onChunk = undefined;
        resolve(undefined);
      }, timeoutMs);

      this.onChunk = () => {
        const line = this.takeLine();
        if (line === undefined) {
          return;
        }

        clearTimeout(timer);
        this.onChunk = undefined;
        resolve(line);
      };
    });
  }

  /** A reply ends in CR, LF or both, so a run of terminators separates lines rather than making empty ones. */
  private takeLine(): string | undefined {
    this.rxBuffer = this.rxBuffer.replace(/^[\r\n]+/, "");
    const end = this.rxBuffer.search(/[\r\n]/);
    if (end < 0) {
      return undefined;
    }

    const line = this.rxBuffer.slice(0, end).trim();
    this.rxBuffer = this.rxBuffer.slice(end + 1);
    return line;
  }
}
