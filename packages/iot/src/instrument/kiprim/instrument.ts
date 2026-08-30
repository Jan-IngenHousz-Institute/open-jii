/**
 * Kiprim DC source: the calibration lamp's power supply.
 *
 * Drives the PAR sweep in the Ambit factory procedure, stepping the lamp
 * through a current series while the device under test and a reference sensor
 * are read at each setpoint.
 */
import { DEFAULT_MAX_BUFFER_SIZE } from "../../driver/driver-base";
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { defaultLogger } from "../../utils/logger/logger";
import type { BenchInstrument, InstrumentSetpoint } from "../interface";
import { findSetpoint } from "../interface";
import { KIPRIM_COMMANDS, KIPRIM_IDENTITY_TOKEN, KIPRIM_LIMITS } from "./commands";

export interface KiprimConfig {
  /** How long to wait for the `*IDN?` reply. */
  identifyTimeoutMs?: number;
}

const DEFAULT_IDENTIFY_TIMEOUT_MS = 2_000;

export class KiprimDcSource implements BenchInstrument {
  readonly model = "kiprim-dc";
  readonly identityToken = KIPRIM_IDENTITY_TOKEN;

  readonly setpoints: readonly InstrumentSetpoint[] = [
    { name: "current_a", unit: "A", min: 0, max: KIPRIM_LIMITS.CURRENT_MAX_A },
    { name: "voltage_v", unit: "V", min: 0, max: KIPRIM_LIMITS.VOLTAGE_MAX_V },
  ];

  private transport: ITransportAdapter | undefined;
  private readonly log: Logger;
  private readonly identifyTimeoutMs: number;
  private rxBuffer = "";
  private onChunk: (() => void) | undefined;

  constructor(config?: KiprimConfig, logger?: Logger) {
    this.log = logger ?? defaultLogger;
    this.identifyTimeoutMs = config?.identifyTimeoutMs ?? DEFAULT_IDENTIFY_TIMEOUT_MS;
  }

  initialize(transport: ITransportAdapter): Promise<void> {
    this.transport = transport;
    this.rxBuffer = "";
    transport.onDataReceived((data) => {
      this.rxBuffer += data;
      // A miswired port can stream indefinitely; the supply only ever owes us
      // one short identity line, so an oversized buffer is noise, not a reply.
      if (this.rxBuffer.length > DEFAULT_MAX_BUFFER_SIZE) {
        this.log.error("Kiprim receive buffer exceeded max size, discarding data");
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
    await transport.send(KIPRIM_COMMANDS.IDENTIFY);
    return this.awaitLine(this.identifyTimeoutMs);
  }

  async applySetpoint(name: string, value: number): Promise<void> {
    const setpoint = findSetpoint(this, name);
    if (!setpoint) {
      throw new Error(`Kiprim DC source has no setpoint "${name}"`);
    }
    if (!Number.isFinite(value) || value < setpoint.min || value > setpoint.max) {
      throw new Error(
        `Setpoint ${name} must be between ${setpoint.min} and ${setpoint.max} ${setpoint.unit}`,
      );
    }

    const transport = this.requireTransport();
    const payload =
      name === "current_a" ? KIPRIM_COMMANDS.setCurrent(value) : KIPRIM_COMMANDS.setVoltage(value);
    await transport.send(payload);
  }

  /** Drop the lamp current so an abandoned rig is not left driving it. */
  async shutdown(): Promise<void> {
    if (!this.transport) return;
    try {
      await this.transport.send(KIPRIM_COMMANDS.setCurrent(0));
    } catch (error) {
      this.log.error("Kiprim DC source could not be returned to zero current", error);
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
      throw new Error("Kiprim DC source transport not initialized");
    }
    return this.transport;
  }

  /** Resolve on the first complete line; the supply answers `*IDN?` with one. */
  private awaitLine(timeoutMs: number): Promise<string> {
    const complete = () => this.rxBuffer.includes("\n");
    if (complete()) return Promise.resolve(this.takeLine());

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.onChunk = undefined;
        reject(new Error("Kiprim DC source did not answer"));
      }, timeoutMs);

      this.onChunk = () => {
        if (!complete()) return;
        clearTimeout(timer);
        this.onChunk = undefined;
        resolve(this.takeLine());
      };
    });
  }

  private takeLine(): string {
    const newline = this.rxBuffer.indexOf("\n");
    const line = newline >= 0 ? this.rxBuffer.slice(0, newline) : this.rxBuffer;
    this.rxBuffer = newline >= 0 ? this.rxBuffer.slice(newline + 1) : "";
    return line.trim();
  }
}
