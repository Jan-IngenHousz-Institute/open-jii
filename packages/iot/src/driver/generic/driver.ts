/**
 * Generic Device Driver Implementation
 * Works with any device implementing the simple command interface
 * (Arduino, Raspberry Pi, custom sensors, weather stations, etc.)
 *
 * Commands are sent as JSON objects terminated with \n.
 * Responses are JSON objects (newline-delimited or complete).
 */
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult } from "../driver-base";
import { GENERIC_COMMANDS } from "./commands";
import type { GenericCommandWithParams, CustomCommandWithParams } from "./commands";
import { GENERIC_FRAMING } from "./config";
import type {
  GenericDeviceEvents,
  GenericDeviceInfo,
  GenericCommandResponse,
  GenericDeviceConfig,
  GenericMeasurementData,
} from "./interface";

export class GenericDeviceDriver extends DeviceDriver<GenericDeviceEvents> {
  private responseBuffer = "";

  constructor(logger?: Logger) {
    super(logger);
  }

  override initialize(transport: ITransportAdapter): void {
    super.initialize(transport);

    // Clear any stale response data from a previous session
    this.responseBuffer = "";

    // Setup data receiving
    transport.onDataReceived((data: string) => {
      this.handleDataReceived(data);
    });

    // Setup connection status monitoring
    transport.onStatusChanged((connected: boolean, error?: Error) => {
      if (!connected && error) {
        this.log.error("Generic device connection error:", error);
      }
    });
  }

  private handleDataReceived(data: string): void {
    this.responseBuffer += data;

    // Guard against unbounded buffer growth from malformed/chatty devices
    if (this.responseBuffer.length > this.maxBufferSize) {
      this.log.error("Generic device receive buffer exceeded max size, discarding data");
      void this.emitter.emit("bufferOverflow", {
        discardedBytes: this.responseBuffer.length,
      });
      this.responseBuffer = "";
      return;
    }

    // Try to parse complete JSON responses (assuming newline-delimited or complete JSON)
    try {
      // Try parsing the buffer
      const response = JSON.parse(this.responseBuffer) as GenericCommandResponse;
      void this.emitter.emit("receivedResponse", response);
      this.responseBuffer = ""; // Clear buffer on success
    } catch {
      // Not complete JSON yet, keep buffering
      // Or try line-by-line parsing if newline-delimited
      const lines = this.responseBuffer.split("\n");

      // Keep last incomplete line in buffer
      this.responseBuffer = lines.pop() ?? "";

      // Try to parse each complete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line) as GenericCommandResponse;
            void this.emitter.emit("receivedResponse", response);
          } catch (parseError) {
            // Not valid JSON — emit diagnostic event so consumers can debug
            void this.emitter.emit("parseError", { line, error: parseError });
          }
        }
      }
    }
  }

  async execute<T = unknown>(
    command: string | GenericCommandWithParams | CustomCommandWithParams,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    // Serialize commands so responses are never mismatched
    return this.commandQueue.enqueue(async () => {
      const cmdObject = typeof command === "string" ? { command } : command;

      try {
        // Send command as JSON
        const cmdString = JSON.stringify(cmdObject);
        void this.emitter.emit("sendCommand", cmdObject);

        if (!this.transport) {
          throw new Error("Transport not initialized");
        }

        await this.transport.send(cmdString + GENERIC_FRAMING.LINE_ENDING);

        // Wait for response
        const response = await this.waitForResponse<T>();

        return {
          success: response.status === "success",
          data: response.data,
          error: response.error ? new Error(response.error) : undefined,
        } as CommandResult<T>;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as CommandResult<T>;
      }
    });
  }

  private async waitForResponse<T>(
    timeout = GENERIC_FRAMING.DEFAULT_TIMEOUT,
  ): Promise<GenericCommandResponse<T>> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Response timeout"));
      }, timeout);

      const handleResponse = (response: unknown) => {
        cleanup();
        resolve(response as GenericCommandResponse<T>);
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.emitter.off("receivedResponse", handleResponse);
      };

      this.emitter.once("receivedResponse", handleResponse);
    });
  }

  /** Get device information */
  async getDeviceInfo(): Promise<GenericDeviceInfo> {
    const result = await this.execute<GenericDeviceInfo>({
      command: GENERIC_COMMANDS.INFO,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to get device info");
    }

    return result.data;
  }

  /** Discover available commands from device */
  async discoverCommands(): Promise<string[]> {
    const result = await this.execute<{ commands: string[] }>({
      command: GENERIC_COMMANDS.DISCOVER,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to discover commands");
    }

    return result.data.commands;
  }

  /** Set configuration/protocol JSON on device */
  async setConfig(config: GenericDeviceConfig): Promise<void> {
    const result = await this.execute({
      command: GENERIC_COMMANDS.SET_CONFIG,
      params: config as unknown as Record<string, unknown>,
    });

    if (!result.success) {
      throw result.error ?? new Error("Failed to set configuration");
    }
  }

  /** Get current configuration from device */
  async getConfig(): Promise<GenericDeviceConfig> {
    const result = await this.execute<GenericDeviceConfig>({
      command: GENERIC_COMMANDS.GET_CONFIG,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to get configuration");
    }

    return result.data;
  }

  /** Run measurement based on loaded config */
  async runMeasurement(params?: Record<string, unknown>): Promise<void> {
    const result = await this.execute({
      command: GENERIC_COMMANDS.RUN,
      params,
    });

    if (!result.success) {
      throw result.error ?? new Error("Failed to run measurement");
    }
  }

  /** Stop current measurement */
  async stopMeasurement(): Promise<void> {
    const result = await this.execute({
      command: GENERIC_COMMANDS.STOP,
    });

    if (!result.success) {
      throw result.error ?? new Error("Failed to stop measurement");
    }
  }

  /** Get measurement data */
  async getData<T = unknown>(): Promise<GenericMeasurementData<T>> {
    const result = await this.execute<GenericMeasurementData<T>>({
      command: GENERIC_COMMANDS.GET_DATA,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to get data");
    }

    return result.data;
  }

  /** Ping device */
  async ping(): Promise<boolean> {
    try {
      const result = await this.execute({ command: GENERIC_COMMANDS.PING });
      return result.success;
    } catch {
      return false;
    }
  }

  /** Reset device */
  async reset(): Promise<void> {
    const result = await this.execute({ command: GENERIC_COMMANDS.RESET });

    if (!result.success) {
      throw result.error ?? new Error("Failed to reset device");
    }
  }

  /** Disconnect from device */
  async disconnect(): Promise<void> {
    try {
      await this.execute({ command: GENERIC_COMMANDS.DISCONNECT });
    } catch {
      // Ignore disconnect errors
    }

    await this.destroy();
  }

  override async destroy(): Promise<void> {
    await this.emitter.emit("destroy", undefined);
    this.responseBuffer = "";
    await super.destroy();
  }
}
