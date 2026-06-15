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
import type { CommandResult, ExecuteOptions } from "../driver-base";
import { MULTISPEQ_COMMANDS, MULTISPEQ_CONSOLE } from "./commands";
import type { MultispeqTransportConfig } from "./config";
import { MULTISPEQ_FRAMING } from "./config";
import { resolveCommandTimeoutMs } from "./estimate-protocol-duration";
import type {
  MultispeqStreamEvents,
  MultispeqCommandResult,
  MultispeqDeviceInfo,
} from "./interface";

/** Truncate long commands (e.g. full protocol JSON) so logs stay readable. */
function summarizeCommand(commandStr: string, maxLength = 120): string {
  if (commandStr.length <= maxLength) return commandStr;
  return `${commandStr.slice(0, maxLength)}… (${commandStr.length} chars)`;
}

/**
 * MultispeQ device driver
 * Implements the MultispeQ device communication with checksums and JSON framing
 */
export class MultispeqDriver extends DeviceDriver<MultispeqStreamEvents> {
  private dataBuffer: string[] = [];
  private bufferLength = 0;

  /** Base response timeout (ms) used for short console commands. */
  private readonly defaultTimeout: number;

  /** Aborts the in-flight waitForResponse(), if any. Set while a command waits. */
  private pendingAbort?: () => void;

  constructor(logger?: Logger, config?: Pick<MultispeqTransportConfig, "timeout">) {
    super(logger);
    this.defaultTimeout = config?.timeout ?? MULTISPEQ_FRAMING.DEFAULT_TIMEOUT;
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

  async execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    const timeoutMs = options?.timeoutMs ?? resolveCommandTimeoutMs(command, this.defaultTimeout);

    // Serialize commands so responses are never mismatched
    return this.commandQueue.enqueue(async () => {
      const startedAt = Date.now();
      try {
        // Send command
        const commandStr = stringifyIfObject(command);
        const commandWithEnding = addLineEnding(commandStr, MULTISPEQ_FRAMING.LINE_ENDING);

        if (!this.transport) {
          throw new Error("Transport not initialized");
        }

        this.log.debug("tx", { command: summarizeCommand(commandStr), timeoutMs });
        // Resync barrier: drop any bytes still buffered from a previous command
        // (e.g. a partial frame left by one that timed out or was cancelled)
        // before sending this one. Commands are serialized, so whatever is
        // buffered now necessarily predates this send — letting it linger would
        // fuse a stale fragment onto this command's reply and return wrong data
        // to the next queued execute(). See OJD-1565.
        this.dataBuffer = [];
        this.bufferLength = 0;
        await this.transport.send(commandWithEnding);

        // Wait for response
        const response = await this.waitForResponse(timeoutMs);

        this.log.debug("command completed", { elapsedMs: Date.now() - startedAt, timeoutMs });
        return {
          success: true,
          data: response.data as T,
          checksum: response.checksum,
        } as CommandResult<T>;
      } catch (error) {
        this.log.warn("command failed", {
          elapsedMs: Date.now() - startedAt,
          err: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as CommandResult<T>;
      }
    });
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

  private waitForResponse(timeoutMs: number): Promise<MultispeqCommandResult> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.emitter.off("receivedReplyFromDevice", handler);
        this.pendingAbort = undefined;
      };

      const timeout = setTimeout(() => {
        cleanup();
        this.log.warn("response timeout, sending cancel", { timeoutMs });
        // On timeout the device may still be running a long protocol. Without
        // an explicit cancel it keeps the actinic light on and eventually
        // drops the connection (OJD-1565). Best-effort abort so it returns to
        // idle; we still reject this command as timed out.
        this.sendCancel();
        reject(new Error("Command timeout"));
      }, timeoutMs);

      const handler = (payload: MultispeqCommandResult) => {
        cleanup();
        resolve(payload);
      };

      // Let cancel() abort this wait. The device-side abort (`-1+`) is sent by
      // cancel() itself so it reaches the device immediately, bypassing the
      // command queue.
      this.pendingAbort = () => {
        cleanup();
        reject(new Error("Command cancelled"));
      };

      this.emitter.once("receivedReplyFromDevice", handler);
    });
  }

  /** Best-effort `-1+` cancel switch to the device. */
  private sendCancel(): void {
    this.transport
      ?.send(addLineEnding(MULTISPEQ_CONSOLE.CANCEL, MULTISPEQ_FRAMING.LINE_ENDING))
      .catch(() => undefined);
  }

  /**
   * Abort the in-flight command: send `-1+` to the device immediately
   * (bypassing the command queue so it reaches a long-running protocol) and
   * reject the pending execute() with "Command cancelled". No-op when idle —
   * importantly, this avoids emitting a stray `-1+` whose ack could be
   * mismatched to a later command.
   */
  async cancel(): Promise<void> {
    const abort = this.pendingAbort;
    if (!abort) return;
    this.log.debug("cancel: aborting in-flight command");
    this.pendingAbort = undefined;
    this.sendCancel();
    abort();
    await Promise.resolve();
  }

  async destroy(): Promise<void> {
    // Abort any in-flight command so it rejects immediately instead of hanging
    // until its (possibly multi-minute) timeout after the transport is gone —
    // e.g. the device disconnects mid-measurement. Without this the pending
    // execute() waits the full budget, so the UI looks "still measuring" long
    // after the device left (OJD-1565).
    const abort = this.pendingAbort;
    this.pendingAbort = undefined;
    abort?.();
    this.dataBuffer = [];
    this.bufferLength = 0;
    await super.destroy();
  }
}
