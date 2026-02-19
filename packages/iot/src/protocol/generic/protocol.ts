/**
 * Generic Device Protocol Implementation
 * Works with any device implementing the simple command interface
 */
import type { ITransportAdapter } from "../../transport/interface";
import { Emitter } from "../../utils/emitter";
import { DeviceProtocol } from "../base";
import type { CommandResult } from "../base";
import { GENERIC_COMMANDS } from "./commands";
import type { GenericCommandWithParams, CustomCommandWithParams } from "./commands";
import type {
  GenericDeviceEvents,
  GenericDeviceInfo,
  GenericCommandResponse,
  GenericDeviceConfig,
  GenericMeasurementData,
} from "./interface";

export class GenericDeviceProtocol extends DeviceProtocol {
  private emitter: Emitter<GenericDeviceEvents>;
  private responseBuffer = "";

  constructor() {
    super();
    this.emitter = new Emitter<GenericDeviceEvents>();
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
        console.error("Generic device connection error:", error);
      }
    });
  }

  private handleDataReceived(data: string): void {
    this.responseBuffer += data;

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
          } catch {
            // Not valid JSON, ignore
          }
        }
      }
    }
  }

  async execute<T = unknown>(
    command: string | GenericCommandWithParams | CustomCommandWithParams,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    const cmdObject = typeof command === "string" ? { command } : command;

    try {
      // Send command as JSON
      const cmdString = JSON.stringify(cmdObject);
      void this.emitter.emit("sendCommand", cmdObject);

      if (!this.transport) {
        throw new Error("Transport not initialized");
      }

      await this.transport.send(cmdString + "\n");

      // Wait for response
      const response = await this.waitForResponse<T>();

      return {
        success: response.status === "success",
        data: response.data,
        error: response.error ? new Error(response.error) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async waitForResponse<T>(timeout = 10000): Promise<GenericCommandResponse<T>> {
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

      this.emitter.on("receivedResponse", handleResponse);
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
    this.emitter.removeAllListeners();
    this.responseBuffer = "";
    await super.destroy();
  }

  /** Listen to protocol events */
  on<K extends keyof GenericDeviceEvents>(
    event: K,
    listener: (data: GenericDeviceEvents[K]) => void,
  ): void {
    this.emitter.on(event, listener);
  }

  /** Remove event listener */
  off<K extends keyof GenericDeviceEvents>(
    event: K,
    listener: (data: GenericDeviceEvents[K]) => void,
  ): void {
    this.emitter.off(event, listener);
  }
}
