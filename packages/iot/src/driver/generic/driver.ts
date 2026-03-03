/**
 * Generic Device Driver Implementation
 * Works with any device implementing the simple command interface
 * (Arduino, Raspberry Pi, custom sensors, weather stations, etc.)
 *
 * Commands are sent as JSON objects terminated with a configurable line ending.
 * Responses are JSON objects (newline-delimited or complete).
 *
 * ## Custom commands
 *
 * Use `execute()` directly to send any command string or object — there is no
 * need for a separate `executeCustom()` method:
 *
 * ```ts
 * // String shorthand
 * const result = await driver.execute("MY_CUSTOM_CMD");
 *
 * // Object with params
 * const result = await driver.execute({
 *   command: "MY_CUSTOM_CMD",
 *   params: { channel: 2 },
 * });
 * ```
 */
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult } from "../driver-base";
import { GENERIC_COMMANDS } from "./commands";
import type { GenericCommandWithParams, CustomCommandWithParams } from "./commands";
import { GENERIC_FRAMING } from "./config";
import type { GenericDriverConfig } from "./config";
import type {
  GenericDeviceEvents,
  GenericDeviceInfo,
  GenericCommandResponse,
  GenericDeviceConfig,
  GenericMeasurementData,
} from "./interface";

export class GenericDeviceDriver extends DeviceDriver<GenericDeviceEvents> {
  private responseBuffer = "";

  /** Resolved driver config (defaults merged with caller overrides) */
  private readonly config: Readonly<GenericDriverConfig>;

  /** Cached INFO response — populated during initialize() */
  private deviceInfo: GenericDeviceInfo | null = null;

  /**
   * @param config  Driver-level overrides (timeout, lineEnding).
   *                Transport-specific settings belong on the transport itself.
   * @param logger  Optional logger; defaults to console-backed implementation.
   */
  constructor(config?: Partial<GenericDriverConfig>, logger?: Logger) {
    super(logger);
    this.config = Object.freeze({
      timeout: config?.timeout ?? GENERIC_FRAMING.DEFAULT_TIMEOUT,
      lineEnding: config?.lineEnding ?? GENERIC_FRAMING.LINE_ENDING,
    });
  }

  /**
   * Initialize the driver with a transport adapter.
   *
   * After wiring up data/status handlers the driver automatically sends an
   * INFO command to probe the device's identity and capabilities.  If INFO
   * fails (timeout, unsupported, etc.) the driver logs a warning and
   * continues — capability guards are disabled in that case.
   */
  override async initialize(transport: ITransportAdapter): Promise<void> {
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

    // Probe device capabilities via INFO (best-effort)
    try {
      this.deviceInfo = await this.getDeviceInfo();
    } catch {
      this.log.warn("INFO probe failed during initialize — capability guards disabled");
      this.deviceInfo = null;
    }
  }

  /** Cached device info from the INFO probe during initialize(), or `null` if unavailable */
  get cachedDeviceInfo(): Readonly<GenericDeviceInfo> | null {
    return this.deviceInfo;
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

        await this.transport.send(cmdString + this.config.lineEnding);

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
    timeout = this.config.timeout,
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

  // ─── Capability guard ────────────────────────────────────────────

  /**
   * Throws if the device reported capabilities and the given command is not
   * among them.  When capabilities are unknown (INFO failed or device didn't
   * report them) the guard is a no-op — fail-open for backward compat.
   */
  private requireCapability(command: string): void {
    const caps = this.deviceInfo?.capabilities;
    if (!caps) return; // unknown → allow
    if (!caps.includes(command)) {
      throw new Error(
        `Device does not support ${command} (not listed in capabilities: [${caps.join(", ")}])`,
      );
    }
  }

  // ─── Required commands ───────────────────────────────────────────

  /** Get device information (always available — required command) */
  async getDeviceInfo(): Promise<GenericDeviceInfo> {
    const result = await this.execute<GenericDeviceInfo>({
      command: GENERIC_COMMANDS.INFO,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to get device info");
    }

    return result.data;
  }

  /** Run measurement based on loaded config (always available — required command) */
  async runMeasurement(params?: Record<string, unknown>): Promise<void> {
    const result = await this.execute({
      command: GENERIC_COMMANDS.RUN,
      params,
    });

    if (!result.success) {
      throw result.error ?? new Error("Failed to run measurement");
    }
  }

  // ─── Optional commands (guarded by capabilities) ─────────────────

  /** Discover available commands from device */
  async discoverCommands(): Promise<string[]> {
    this.requireCapability(GENERIC_COMMANDS.DISCOVER);

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
    this.requireCapability(GENERIC_COMMANDS.SET_CONFIG);

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
    this.requireCapability(GENERIC_COMMANDS.GET_CONFIG);

    const result = await this.execute<GenericDeviceConfig>({
      command: GENERIC_COMMANDS.GET_CONFIG,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error("Failed to get configuration");
    }

    return result.data;
  }

  /** Stop current measurement */
  async stopMeasurement(): Promise<void> {
    this.requireCapability(GENERIC_COMMANDS.STOP);

    const result = await this.execute({
      command: GENERIC_COMMANDS.STOP,
    });

    if (!result.success) {
      throw result.error ?? new Error("Failed to stop measurement");
    }
  }

  /** Get measurement data */
  async getData<T = unknown>(): Promise<GenericMeasurementData<T>> {
    this.requireCapability(GENERIC_COMMANDS.GET_DATA);

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
    this.requireCapability(GENERIC_COMMANDS.PING);

    try {
      const result = await this.execute({ command: GENERIC_COMMANDS.PING });
      return result.success;
    } catch {
      return false;
    }
  }

  /** Reset device */
  async reset(): Promise<void> {
    this.requireCapability(GENERIC_COMMANDS.RESET);

    const result = await this.execute({ command: GENERIC_COMMANDS.RESET });

    if (!result.success) {
      throw result.error ?? new Error("Failed to reset device");
    }
  }

  /** Disconnect from device */
  async disconnect(): Promise<void> {
    this.requireCapability(GENERIC_COMMANDS.DISCONNECT);

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
    this.deviceInfo = null;
    await super.destroy();
  }
}
