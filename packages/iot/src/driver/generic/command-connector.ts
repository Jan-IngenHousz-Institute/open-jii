/**
 * Raw command connector, the last resort for unidentified devices.
 *
 * Unlike GenericDeviceDriver (structured openJII JSON contract: {"command"}
 * envelopes, {"status","data","error"} replies, INFO capability probing),
 * this connector is a verbatim passthrough: strings are sent as-is, objects
 * JSON-stringified, plus a line ending; each newline-terminated reply line is
 * returned unchanged (JSON-parsed when possible).
 */
import type { DeviceIdentity, SensorFamily } from "../../core/families";
import type { ITransportAdapter } from "../../transport/interface";
import { addLineEnding, stringifyIfObject, tryParseJson } from "../../utils/framing/framing";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult } from "../driver-base";

/** Default response timeout (ms) for raw line commands. */
const DEFAULT_CONNECTOR_TIMEOUT_MS = 10_000;

/** Events emitted by the raw command connector */
export interface GenericCommandConnectorEvents extends Record<string, unknown> {
  receivedLine: unknown;
  bufferOverflow: { discardedBytes: number };
}

/** Construction options for the raw command connector */
export interface GenericCommandConnectorConfig {
  /** Response timeout in ms (default 10 000) */
  timeoutMs?: number;
  /** Line ending appended to every command (default "\n") */
  lineEnding?: string;
}

export class GenericCommandConnector extends DeviceDriver<GenericCommandConnectorEvents> {
  override readonly family: SensorFamily = "generic";
  protected override readonly responseEvent = "receivedLine" as const;

  private readonly lineEnding: string;
  private rxBuffer = "";

  constructor(config?: GenericCommandConnectorConfig, logger?: Logger) {
    super(logger);
    this.defaultTimeoutMs = config?.timeoutMs ?? DEFAULT_CONNECTOR_TIMEOUT_MS;
    this.lineEnding = config?.lineEnding ?? "\n";
  }

  initialize(transport: ITransportAdapter): void {
    void super.initialize(transport);
    this.rxBuffer = "";
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    this.notifyRxChunk(data.length);
    this.rxBuffer += data;

    // Guard against unbounded buffer growth from malformed/chatty devices
    if (this.rxBuffer.length > this.maxBufferSize) {
      this.log.error("Command connector receive buffer exceeded max size, discarding data");
      void this.emitter.emit("bufferOverflow", { discardedBytes: this.rxBuffer.length });
      this.rxBuffer = "";
      return;
    }

    if (!this.rxBuffer.includes("\n")) {
      return;
    }

    // Emit each complete line (minus a trailing \r) as a response
    const lines = this.rxBuffer.split("\n");
    this.rxBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (clean.length === 0) continue;
      void this.emitter.emit("receivedLine", tryParseJson(clean));
    }
  }

  /** Verbatim payload: strings as-is, objects JSON-stringified, plus line ending. */
  protected override encodeCommand(command: string | object): string {
    return addLineEnding(stringifyIfObject(command), this.lineEnding);
  }

  protected override decodeResponse<T>(payload: unknown): CommandResult<T> {
    return { success: true, data: payload as T } as CommandResult<T>;
  }

  getDeviceIdentity(): Promise<DeviceIdentity> {
    return Promise.resolve({ family: this.family, raw: {} });
  }

  override async destroy(): Promise<void> {
    this.rxBuffer = "";
    await super.destroy();
  }
}
