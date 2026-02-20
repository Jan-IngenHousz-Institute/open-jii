/**
 * MultispeQ Protocol Implementation
 */
import type { ITransportAdapter } from "../../transport/interface";
import { Emitter } from "../../utils/emitter";
import {
  stringifyIfObject,
  tryParseJson,
  extractChecksum,
  addLineEnding,
  removeLineEnding,
} from "../../utils/framing";
import { DeviceProtocol } from "../base";
import type { CommandResult } from "../base";
import type {
  MultispeqStreamEvents,
  MultispeqCommandResult,
  MultispeqDeviceInfo,
} from "./interface";

/**
 * MultispeQ protocol handler
 * Implements the MultispeQ device communication protocol with checksums and JSON framing
 */
export class MultispeqProtocol extends DeviceProtocol {
  private emitter = new Emitter<MultispeqStreamEvents>();
  private dataBuffer: string[] = [];
  private pendingResponse: Promise<MultispeqCommandResult> | null = null;

  initialize(transport: ITransportAdapter): void {
    super.initialize(transport);

    // Set up transport data handler
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    // Buffer data until we receive a complete message (ends with newline)
    this.dataBuffer.push(data);

    if (!data.endsWith("\n")) {
      return;
    }

    // Process complete message
    const fullData = this.dataBuffer.join("");
    this.dataBuffer = [];

    const cleanData = removeLineEnding(fullData);
    const { data: jsonData, checksum } = extractChecksum(cleanData, 8);

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

    try {
      // Send command
      const commandStr = stringifyIfObject(command);
      const commandWithEnding = addLineEnding(commandStr);

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
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getDeviceInfo(): Promise<MultispeqDeviceInfo> {
    const batteryResult = await this.execute<string>("battery");

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
      }, 30000); // 30 second timeout

      const handler = (payload: MultispeqCommandResult) => {
        clearTimeout(timeout);
        this.emitter.off("receivedReplyFromDevice", handler);
        resolve(payload);
      };

      this.emitter.on("receivedReplyFromDevice", handler);
    });
  }

  async destroy(): Promise<void> {
    this.emitter.removeAllListeners();
    this.dataBuffer = [];
    await super.destroy();
  }
}
