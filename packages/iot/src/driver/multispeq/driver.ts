/**
 * MultispeQ Driver Implementation
 *
 * MultispeQ devices communicate via Bluetooth Classic or USB Serial.
 * Commands are sent as strings (or JSON) terminated with \r\n.
 * Responses are newline-terminated with an 8-char checksum before the newline.
 */
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
import type { CommandResult } from "../driver-base";
import { MULTISPEQ_COMMANDS } from "./commands";
import { MULTISPEQ_FRAMING } from "./config";
import type {
  MultispeqStreamEvents,
  MultispeqCommandResult,
  MultispeqDeviceInfo,
} from "./interface";

/**
 * MultispeQ device driver
 * Implements the MultispeQ device communication with checksums and JSON framing
 */
export class MultispeqDriver extends DeviceDriver<MultispeqStreamEvents> {
  private dataBuffer: string[] = [];
  private bufferLength = 0;

  constructor(logger?: Logger) {
    super(logger);
  }

  initialize(transport: ITransportAdapter): void {
    super.initialize(transport);

    // Set up transport data handler
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    // Buffer data until we receive a complete message (ends with newline)
    this.dataBuffer.push(data);

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
    const { data: jsonData, checksum } = extractChecksum(
      cleanData,
      MULTISPEQ_FRAMING.CHECKSUM_LENGTH,
    );

    // Try to parse as JSON, fall back to raw string
    const parsedData: unknown = tryParseJson(jsonData);

    // Emit response event
    void this.emitter.emit("receivedReplyFromDevice", {
      data: parsedData,
      checksum,
    });
  }

  async execute<T = unknown>(command: string | object): Promise<CommandResult<T>> {
    this.ensureInitialized();

    // Serialize commands so responses are never mismatched
    return this.commandQueue.enqueue(async () => {
      try {
        // Send command
        const commandStr = stringifyIfObject(command);
        const commandWithEnding = addLineEnding(commandStr, MULTISPEQ_FRAMING.LINE_ENDING);

        if (!this.transport) {
          throw new Error("Transport not initialized");
        }

        await this.transport.send(commandWithEnding);

        // Wait for response
        const response = await this.waitForResponse();

        return {
          success: true,
          data: response.data as T,
          checksum: response.checksum,
        } as CommandResult<T>;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as CommandResult<T>;
      }
    });
  }

  async getDeviceInfo(): Promise<MultispeqDeviceInfo> {
    // device_info returns JSON with name, version, id, battery, firmware, config
    const result = await this.execute<MultispeqDeviceInfo>(MULTISPEQ_COMMANDS.DEVICE_INFO);

    if (result.success && typeof result.data === "object") {
      return result.data;
    }

    // Fallback: try battery command alone (older firmware or partial failure)
    const batteryResult = await this.execute<string>(MULTISPEQ_COMMANDS.BATTERY);
    const info: MultispeqDeviceInfo = {};

    if (batteryResult.success && typeof batteryResult.data === "string") {
      const batteryStr = batteryResult.data.replace("battery:", "");
      const battery = parseInt(batteryStr, 10);
      if (!isNaN(battery)) {
        info.device_battery = battery;
      }
    }

    return info;
  }

  private waitForResponse(): Promise<MultispeqCommandResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.emitter.off("receivedReplyFromDevice", handler);
        reject(new Error("Command timeout"));
      }, MULTISPEQ_FRAMING.DEFAULT_TIMEOUT);

      const handler = (payload: MultispeqCommandResult) => {
        clearTimeout(timeout);
        resolve(payload);
      };

      this.emitter.once("receivedReplyFromDevice", handler);
    });
  }

  async destroy(): Promise<void> {
    this.dataBuffer = [];
    this.bufferLength = 0;
    await super.destroy();
  }
}
