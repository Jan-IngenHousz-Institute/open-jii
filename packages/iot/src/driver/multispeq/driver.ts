/**
 * MultispeQ Driver Implementation
 *
 * MultispeQ devices communicate via Bluetooth Classic or USB Serial.
 * Commands are sent as strings (or JSON) terminated with \r\n.
 * Responses are newline-terminated with an 8-char checksum before the newline.
 */
import type { DeviceIdentity, SensorFamily } from "../../core/families";
import type { ITransportAdapter } from "../../transport/interface";
import {
  stringifyIfObject,
  tryParseJson,
  extractChecksum,
  addLineEnding,
  removeLineEnding,
} from "../../utils/framing/framing";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult, ExecuteOptions } from "../driver-base";
import { MULTISPEQ_COMMANDS, MULTISPEQ_CONSOLE } from "./commands";
import type { MultispeqTransportConfig } from "./config";
import { MULTISPEQ_FRAMING } from "./config";
import type {
  MultispeqStreamEvents,
  MultispeqCommandResult,
  MultispeqDeviceInfo,
} from "./interface";
import { resolveCommandTimeoutMs } from "./multispeq-protocol-estimator";

/**
 * MultispeQ device driver
 * Implements the MultispeQ device communication with checksums and JSON framing
 */
export class MultispeqDriver extends DeviceDriver<MultispeqStreamEvents> {
  override readonly family: SensorFamily = "multispeq";
  protected override readonly responseEvent = "receivedReplyFromDevice" as const;

  private dataBuffer: string[] = [];
  private bufferLength = 0;

  constructor(logger?: Logger, config?: Pick<MultispeqTransportConfig, "timeout">) {
    super(logger);
    this.defaultTimeoutMs = config?.timeout ?? MULTISPEQ_FRAMING.DEFAULT_TIMEOUT;
  }

  initialize(transport: ITransportAdapter): void {
    void super.initialize(transport);

    // Set up transport data handler
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    // Buffer data until we receive a complete message (ends with newline)
    this.dataBuffer.push(data);

    this.log.debug("rx chunk", {
      chars: data.length,
      buffered: this.bufferLength + data.length,
    });
    this.notifyRxChunk(data.length);

    // Guard against unbounded buffer growth from malformed/chatty devices
    this.bufferLength += data.length;
    if (this.bufferLength > this.maxBufferSize) {
      this.log.error("MultispeQ receive buffer exceeded max size, discarding data");
      void this.emitter.emit("bufferOverflow", { discardedBytes: this.bufferLength });
      this.dataBuffer = [];
      this.bufferLength = 0;
      return;
    }

    if (!data.endsWith("\n")) {
      return;
    }

    // Process complete message
    const fullData = this.dataBuffer.join("");
    this.dataBuffer = [];
    this.bufferLength = 0;

    const cleanData = removeLineEnding(fullData);

    // Only extract checksum if the data portion (without last 8 chars) is valid JSON.
    // Plain text responses like "MultispeQ Ready" don't have checksums.
    const { data: possibleJson, checksum: possibleChecksum } = extractChecksum(
      cleanData,
      MULTISPEQ_FRAMING.CHECKSUM_LENGTH,
    );
    const parsed = tryParseJson(possibleJson);
    const hasChecksum = parsed !== possibleJson; // tryParseJson returns the original string if parsing fails

    const parsedData = hasChecksum ? parsed : tryParseJson(cleanData);
    const checksum = hasChecksum ? possibleChecksum : undefined;

    this.log.debug("rx complete", { chars: cleanData.length, checksum: checksum ?? "none" });

    // Emit response event
    void this.emitter.emit("receivedReplyFromDevice", {
      data: parsedData,
      checksum,
    });
  }

  /** Full wire payload: command string (JSON for objects) plus CRLF. */
  protected override encodeCommand(command: string | object): string {
    return addLineEnding(stringifyIfObject(command), MULTISPEQ_FRAMING.LINE_ENDING);
  }

  protected override decodeResponse<T>(payload: unknown): CommandResult<T> {
    const response = payload as MultispeqCommandResult;
    return {
      success: true,
      data: response.data as T,
      checksum: response.checksum,
    } as CommandResult<T>;
  }

  /** Size the timeout to the command (measurement protocols get a bigger budget). */
  protected override resolveTimeoutMs(command: string | object, options?: ExecuteOptions): number {
    return options?.timeoutMs ?? resolveCommandTimeoutMs(command, this.defaultTimeoutMs);
  }

  // Resync barrier: drop bytes buffered from a previous (timed-out/cancelled)
  // command; commands are serialized, so anything buffered predates this send
  // and a stale fragment would fuse onto this command's reply. See OJD-1565.
  protected override beforeSend(command: string | object): void {
    void command;
    this.dataBuffer = [];
    this.bufferLength = 0;
  }

  // On timeout the device may still be running a long protocol. Without
  // an explicit cancel it keeps the actinic light on and eventually
  // drops the connection (OJD-1565). Best-effort abort so it returns to
  // idle; the command itself is still rejected as timed out.
  protected override onResponseTimeout(timeoutMs: number): void {
    this.log.warn("response timeout, sending cancel", { timeoutMs });
    this.sendCancelToDevice();
  }

  /** Best-effort `-1+` cancel switch to the device. */
  protected override sendCancelToDevice(): void {
    this.transport
      ?.send(addLineEnding(MULTISPEQ_CONSOLE.CANCEL, MULTISPEQ_FRAMING.LINE_ENDING))
      .catch(() => undefined);
  }

  async getDeviceInfo(): Promise<MultispeqDeviceInfo> {
    // device_info returns JSON with name, version, id, battery, firmware, config
    // const result = await this.execute<MultispeqDeviceInfo>(MULTISPEQ_COMMANDS.DEVICE_INFO);

    // if (result.success && typeof result.data === "object") {
    //   return result.data;
    // }

    // Fallback: try battery command alone (older firmware or partial failure)
    const batteryResult = await this.execute<string>(MULTISPEQ_COMMANDS.BATTERY);
    const helloResult = await this.execute<string>(MULTISPEQ_COMMANDS.HELLO);

    const info: MultispeqDeviceInfo = {};

    if (batteryResult.success && typeof batteryResult.data === "string") {
      const batteryStr = batteryResult.data.replace("battery:", "");
      const battery = parseInt(batteryStr, 10);
      if (!isNaN(battery)) {
        info.device_battery = battery;
      }
    }

    if (helloResult.success && typeof helloResult.data === "string") {
      info.device_name = helloResult.data;
    }

    return info;
  }

  /** Identify the device via getDeviceInfo() (name + battery). */
  async getDeviceIdentity(): Promise<DeviceIdentity> {
    const info = await this.getDeviceInfo();
    return {
      family: "multispeq",
      name: typeof info.device_name === "string" ? info.device_name : undefined,
      batteryPercent: typeof info.device_battery === "number" ? info.device_battery : undefined,
      raw: info,
    };
  }

  override async destroy(): Promise<void> {
    this.dataBuffer = [];
    this.bufferLength = 0;
    await super.destroy();
  }
}
