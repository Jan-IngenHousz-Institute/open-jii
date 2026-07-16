/**
 * Ambit driver: plain-text serial console, command/response only.
 *
 * The firmware has NO reply framing (free-text lines, silent writers, no
 * terminator), so replies are collected until an RX quiet window elapses.
 * The device light-sleeps after console idle and prints a wake byte >127;
 * `initialize()`/`ensureAwake()` run the Calibratron-style hello poll until
 * the `NEW ... Ready` sentinel answers. Protocol JSON is rejected outright:
 * an Ambit measures via its Ambyte gateway, a direct session is for
 * calibration commands and spot readings.
 */
import type { DeviceIdentity, SensorFamily } from "../../core/families";
import type { ITransportAdapter } from "../../transport/interface";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult, ExecuteOptions } from "../driver-base";
import {
  AMBIT_BAD_COMMAND,
  AMBIT_COMMANDS,
  AMBIT_COMMAND_OVERRIDES,
  AMBIT_SILENT_COMMANDS,
} from "./commands";
import { AMBIT_FRAMING } from "./config";
import type { AmbitDriverConfig } from "./config";
import type { AmbitStreamEvents } from "./interface";
import { AMBIT_REPLY_PARSERS } from "./response-parsers";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AmbitDriver extends DeviceDriver<AmbitStreamEvents> {
  override readonly family: SensorFamily = "ambit";

  private readonly defaultTimeoutMs: number;
  private readonly quietWindowMs: number;

  private rxBuffer = "";
  private onChunk: (() => void) | undefined;
  private lastTrafficAt = 0;

  constructor(config?: AmbitDriverConfig, logger?: Logger) {
    super(logger);
    this.defaultTimeoutMs = config?.timeoutMs ?? AMBIT_FRAMING.DEFAULT_TIMEOUT;
    this.quietWindowMs = config?.quietWindowMs ?? AMBIT_FRAMING.QUIET_WINDOW_MS;
  }

  override async initialize(transport: ITransportAdapter): Promise<void> {
    await super.initialize(transport);
    this.rxBuffer = "";
    transport.onDataReceived((data) => this.handleDataReceived(data));

    // Best-effort wake so the first real command does not race the sleep
    // loop; a failure surfaces on that first command instead of here.
    try {
      await this.wake();
    } catch {
      this.log.warn("Ambit wake handshake failed during initialize");
    }
  }

  private handleDataReceived(data: string): void {
    // The sleep loop emits non-ASCII idle/boot bytes; strip them before they
    // corrupt a reply.
    let clean = "";
    for (const ch of data) {
      if (ch.charCodeAt(0) <= 127) clean += ch;
    }
    this.lastTrafficAt = Date.now();
    this.rxBuffer += clean;

    if (this.rxBuffer.length > this.maxBufferSize) {
      this.log.error("Ambit receive buffer exceeded max size, discarding data");
      void this.emitter.emit("bufferOverflow", { discardedBytes: this.rxBuffer.length });
      this.rxBuffer = "";
      return;
    }
    this.onChunk?.();
  }

  /**
   * Send one payload and collect the unframed reply: resolves once data has
   * arrived and `quietWindowMs` passes without more, rejects on `timeoutMs`
   * with nothing received.
   */
  private async sendAndCollect(
    payload: string,
    quietWindowMs: number,
    timeoutMs: number,
  ): Promise<string> {
    if (!this.transport) {
      throw new Error("Transport not initialized");
    }
    this.rxBuffer = "";
    this.lastTrafficAt = Date.now();
    await this.transport.send(payload);

    return new Promise<string>((resolve, reject) => {
      let quietTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = () => {
        cleanup();
        const reply = this.rxBuffer;
        this.rxBuffer = "";
        void this.emitter.emit("receivedReply", reply);
        resolve(reply);
      };

      const overallTimer = setTimeout(() => {
        if (this.rxBuffer.trim().length > 0) {
          finish();
          return;
        }
        cleanup();
        reject(new Error("Response timeout"));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(overallTimer);
        if (quietTimer) clearTimeout(quietTimer);
        this.onChunk = undefined;
      };

      this.onChunk = () => {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          if (this.rxBuffer.trim().length > 0) finish();
        }, quietWindowMs);
      };
    });
  }

  /** Poll hello until the ready sentinel answers (Calibratron's wake loop). */
  private async wake(): Promise<void> {
    for (let attempt = 0; attempt < AMBIT_FRAMING.WAKE_RETRIES; attempt++) {
      try {
        const reply = await this.sendAndCollect(
          `${AMBIT_COMMANDS.HELLO}${AMBIT_FRAMING.LINE_ENDING}`,
          100,
          400,
        );
        if (reply.includes(AMBIT_FRAMING.READY_SENTINEL) || /\bready\b/i.test(reply)) {
          return;
        }
      } catch {
        // silent attempt; keep polling
      }
      await delay(AMBIT_FRAMING.WAKE_INTERVAL_MS);
    }
    throw new Error("Ambit did not wake (no hello reply)");
  }

  /** Re-run the wake poll when the console has idled past the sleep threshold. */
  private async ensureAwake(): Promise<void> {
    if (Date.now() - this.lastTrafficAt < AMBIT_FRAMING.SLEEP_AFTER_IDLE_MS) return;
    await this.wake();
  }

  async execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    if (typeof command !== "string") {
      return {
        success: false,
        error: new Error(
          "Ambit does not accept protocol JSON. Use a command cell (hello, get_par, set_spec, ...)",
        ),
      };
    }

    return this.commandQueue.enqueue(async () => {
      try {
        await this.ensureAwake();

        const trimmed = command.trim();
        const token = trimmed.split(",")[0].trim();
        const payload = `${trimmed}${AMBIT_FRAMING.LINE_ENDING}`;

        // Calibration writers reply with nothing: fire, settle, re-verify.
        if (AMBIT_SILENT_COMMANDS.includes(token)) {
          if (!this.transport) throw new Error("Transport not initialized");
          this.rxBuffer = "";
          this.lastTrafficAt = Date.now();
          await this.transport.send(payload);
          await delay(AMBIT_FRAMING.SETTLE_MS);
          const verify = await this.sendAndCollect(
            `${AMBIT_COMMANDS.HELLO}${AMBIT_FRAMING.LINE_ENDING}`,
            this.quietWindowMs,
            this.defaultTimeoutMs,
          );
          if (!/\bready\b/i.test(verify)) {
            throw new Error(`Ambit did not acknowledge ${token} (no ready reply)`);
          }
          return { success: true, data: { acknowledged: token } as T };
        }

        const override = AMBIT_COMMAND_OVERRIDES[token] ?? {};
        const reply = await this.sendAndCollect(
          payload,
          override.quietWindowMs ?? this.quietWindowMs,
          options?.timeoutMs ?? override.timeoutMs ?? this.defaultTimeoutMs,
        );
        const text = reply.trim();

        if (text.includes(AMBIT_BAD_COMMAND)) {
          throw new Error(`Ambit rejected the command: ${token}`);
        }

        const parsed = AMBIT_REPLY_PARSERS[token]?.(text);
        return { success: true, data: (parsed ?? text) as T };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });
  }

  /** Identity from the hello sentinel line; the printed name is hardcoded upstream. */
  async getDeviceIdentity(): Promise<DeviceIdentity> {
    const result = await this.execute<unknown>(AMBIT_COMMANDS.HELLO);
    const text = typeof result.data === "string" ? result.data : "";
    const match = /^(.*?)\s*\bready\b\s*$/im.exec(text);
    const name = match?.[1]?.trim();
    return {
      family: this.family,
      name: name === "" ? undefined : name,
      raw: { helloReply: text },
    };
  }

  override async destroy(): Promise<void> {
    this.rxBuffer = "";
    this.onChunk = undefined;
    await super.destroy();
  }
}
