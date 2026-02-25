/**
 * MultispeQ Protocol Implementation
 */
import type { ITransportAdapter } from "../../transport/interface";
import { Emitter } from "../../utils/emitter";
import { stringifyIfObject, tryParseJson, addLineEnding } from "../../utils/framing";
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
    console.log("[MultispeqProtocol] Initializing with transport");

    // Set up transport data handler
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    console.log("[MultispeqProtocol] Raw data chunk received:", JSON.stringify(data));

    // Buffer data until we receive a complete message (ends with newline)
    this.dataBuffer.push(data);

    if (!data.endsWith("\n")) {
      console.log(
        "[MultispeqProtocol] Buffering incomplete message, chunks so far:",
        this.dataBuffer.length,
      );
      return;
    }

    // Process complete message
    const fullData = this.dataBuffer.join("");
    this.dataBuffer = [];

    console.log("[MultispeqProtocol] Complete message received, length:", fullData.length);

    // Strip trailing newline, then extract the 8-char checksum before it.
    // Format from firmware: <json_or_string><8-char checksum>\n
    // Match mobile: jsonData = totalData.slice(0, -9), checksum = totalData.slice(-9, -1)
    const jsonData = fullData.slice(0, -9);
    const checksum = fullData.slice(-9, -1);

    console.log("[MultispeqProtocol] Extracted checksum:", checksum);
    console.log("[MultispeqProtocol] JSON data (first 500 chars):", jsonData.substring(0, 500));

    // Try to parse as JSON, fall back to raw string
    const parsedData: unknown = tryParseJson(jsonData);

    console.log("[MultispeqProtocol] Parsed data type:", typeof parsedData);

    // Emit response event
    void this.emitter.emit("receivedReplyFromDevice", {
      data: parsedData,
      checksum,
    });
  }

  async execute<T = unknown>(command: string | object): Promise<CommandResult<T>> {
    this.ensureInitialized();

    const commandStr = stringifyIfObject(command);
    console.log("[MultispeqProtocol] Executing command:", commandStr.substring(0, 500));

    try {
      // Send command
      const commandWithEnding = addLineEnding(commandStr);

      if (!this.transport) {
        throw new Error("Transport not initialized");
      }

      // Register response listener BEFORE sending to avoid race condition
      // (fast serial responses can arrive before the listener is set up)
      const responsePromise = this.waitForResponse();

      console.log("[MultispeqProtocol] Sending to transport, length:", commandWithEnding.length);
      await this.transport.send(commandWithEnding);
      console.log("[MultispeqProtocol] Command sent, waiting for response...");

      // Wait for response
      const response = await responsePromise;

      console.log(
        "[MultispeqProtocol] Response received, success: true, data type:",
        typeof response.data,
      );
      return {
        success: true,
        data: response.data as T,
        checksum: response.checksum,
      };
    } catch (error) {
      console.error("[MultispeqProtocol] Command failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getDeviceInfo(): Promise<MultispeqDeviceInfo> {
    const batteryResult = await this.execute<string>("battery");

    const info: MultispeqDeviceInfo = {};

    if (batteryResult.success) {
      // The battery response is the full raw string from the device (e.g. "battery:91")
      // after checksum extraction. Parse the number from it.
      const raw =
        typeof batteryResult.data === "string"
          ? batteryResult.data
          : String(batteryResult.data ?? "");
      console.log("[MultispeqProtocol] getDeviceInfo raw battery data:", JSON.stringify(raw));
      const match = raw.match(/(\d+)/);
      if (match) {
        const battery = parseInt(match[1], 10);
        if (!isNaN(battery)) {
          info.device_battery = battery;
        }
      }
    }

    console.log("[MultispeqProtocol] getDeviceInfo result:", info);
    return info;
  }

  private waitForResponse(): Promise<MultispeqCommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log("[MultispeqProtocol] waitForResponse: listener registered, waiting...");

      const timeout = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error("[MultispeqProtocol] Command timed out after", elapsed, "ms");
        console.error("[MultispeqProtocol] Timeout debug state:", {
          dataBufferLength: this.dataBuffer.length,
          dataBufferPreview: this.dataBuffer.join("").substring(0, 500),
          transportConnected: this.transport?.isConnected(),
          initialized: this.initialized,
        });
        this.emitter.off("receivedReplyFromDevice", handler);
        reject(new Error("Command timeout"));
      }, 30000); // 30 second timeout

      const handler = (payload: MultispeqCommandResult) => {
        const elapsed = Date.now() - startTime;
        console.log("[MultispeqProtocol] Response handler fired after", elapsed, "ms");
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
