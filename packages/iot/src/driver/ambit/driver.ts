/**
 * Ambit driver: dual-mode serial session, like MiniPAR.
 *
 * Text console (string commands): the firmware has NO reply framing
 * (free-text lines, silent writers, no terminator), so replies are collected
 * until an RX quiet window elapses. The device light-sleeps after console
 * idle and prints a wake byte >127; `initialize()`/`ensureAwake()` run the
 * Calibratron-style hello poll until the `NEW ... Ready` sentinel answers.
 *
 * JSON envelope (object/array commands): the firmware's openJII protocol
 * module runs measurements (`arrun`) sent as protocol JSON and replies one
 * envelope of `device_*` header fields plus a `sample` array, terminated by
 * the constant `7A1E3AA1` footer. The wake poll still runs first: a
 * protocol write must not race the sleep loop.
 */
import type { DeviceIdentity, SensorFamily } from "../../core/families";
import type { ITransportAdapter } from "../../transport/interface";
import {
  collectReply,
  parseOpenJiiEnvelope,
  parseOpenJiiTopLevelError,
} from "../../utils/framing/openjii-envelope";
import type { RxCollectorHooks } from "../../utils/framing/openjii-envelope";
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
  private readonly protocolTimeoutMs: number;

  private rxBuffer = "";
  private onChunk: (() => void) | undefined;
  private lastTrafficAt = 0;
  /** eFuse MAC from the last trace, remembered for identity reporting. */
  private sensorId: string | undefined;

  constructor(config?: AmbitDriverConfig, logger?: Logger) {
    super(logger);
    this.defaultTimeoutMs = config?.timeoutMs ?? AMBIT_FRAMING.DEFAULT_TIMEOUT;
    this.quietWindowMs = config?.quietWindowMs ?? AMBIT_FRAMING.QUIET_WINDOW_MS;
    this.protocolTimeoutMs = config?.protocolTimeoutMs ?? AMBIT_FRAMING.PROTOCOL_TIMEOUT;
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

  /** RX hooks over this driver's buffer for the shared reply collector. */
  private readonly rxHooks: RxCollectorHooks = {
    read: () => this.rxBuffer,
    take: () => {
      const reply = this.rxBuffer;
      this.rxBuffer = "";
      return reply;
    },
    setOnChunk: (cb) => {
      this.onChunk = cb;
    },
  };

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

    const reply = await collectReply(this.rxHooks, {
      isComplete: () => false,
      quietMs: quietWindowMs,
      timeoutMs,
    });
    void this.emitter.emit("receivedReply", reply);
    return reply;
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

  /** Run protocol JSON through the firmware's openJII envelope: one write, footer-framed reply. */
  private async executeProtocol<T>(
    command: object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    return this.commandQueue.enqueue(async () => {
      try {
        await this.ensureAwake();
        if (!this.transport) {
          throw new Error("Transport not initialized");
        }

        this.rxBuffer = "";
        this.lastTrafficAt = Date.now();
        await this.transport.send(`${JSON.stringify(command)}${AMBIT_FRAMING.LINE_ENDING}`);
        const reply = await collectReply(this.rxHooks, {
          isComplete: (buffer) =>
            parseOpenJiiEnvelope(buffer) !== null || parseOpenJiiTopLevelError(buffer) !== null,
          timeoutMs: options?.timeoutMs ?? this.protocolTimeoutMs,
          strictTimeout: true,
        });
        void this.emitter.emit("receivedReply", reply);

        const envelope = parseOpenJiiEnvelope(reply);
        if (envelope) {
          this.adoptSensorId(envelope);
          void this.emitter.emit("receivedEnvelope", envelope);
          return {
            success: true,
            data: envelope as T,
            checksum: AMBIT_FRAMING.FRAME_FOOTER,
          };
        }
        const errorCode = parseOpenJiiTopLevelError(reply);
        if (errorCode) {
          throw new Error(`Ambit rejected the protocol: ${errorCode}`);
        }
        void this.emitter.emit("parseError", { line: reply, error: "incomplete envelope" });
        throw new Error("Ambit reply was not a complete measurement envelope");
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });
  }

  async execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    if (typeof command !== "string") {
      return this.executeProtocol<T>(command, options);
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

  /**
   * Promote the trace's `sensor_id` to the envelope's `device_id`.
   *
   * `sensor_id` is the ESP32 eFuse MAC, formatted uppercase colon-separated by
   * the firmware (`format_sensor_id`, trace_v3.h) precisely so it is the one
   * stable hardware identity for a unit. It only ever appears nested in the
   * trace, while the platform reads `device_id` off the envelope, so lift it.
   * A firmware-supplied `device_id` is left alone, and the value is remembered
   * so `getDeviceIdentity()` can report it once a measurement has been seen.
   */
  private adoptSensorId(envelope: Record<string, unknown>): void {
    const sensorId = findSensorId(envelope);
    if (!sensorId) return;
    this.sensorId = sensorId;
    envelope.device_id ??= sensorId;
  }

  /**
   * Identity from the hello sentinel line; the printed name is hardcoded
   * upstream. The hardware MAC is not reachable over the text console (the
   * firmware's cmd 33 writes a raw binary struct), so `deviceId` is only
   * populated once a measurement has carried the trace's `sensor_id`.
   */
  async getDeviceIdentity(): Promise<DeviceIdentity> {
    const result = await this.execute<unknown>(AMBIT_COMMANDS.HELLO);
    const text = typeof result.data === "string" ? result.data : "";
    return {
      family: this.family,
      ...(this.sensorId ? { deviceId: this.sensorId } : {}),
      raw: { helloReply: text, ...(this.sensorId ? { sensor_id: this.sensorId } : {}) },
    };
  }

  override async destroy(): Promise<void> {
    this.rxBuffer = "";
    this.onChunk = undefined;
    await super.destroy();
  }
}

/**
 * First `sensor_id` string in a measurement envelope. The firmware nests it in
 * `sample[].set[]` alongside the trace schema, so walk the envelope rather than
 * hardcoding a path that a future trace revision could move.
 */
function findSensorId(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findSensorId(entry, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.sensor_id === "string" && record.sensor_id.trim() !== "") {
    return record.sensor_id;
  }
  for (const entry of Object.values(record)) {
    const found = findSensorId(entry, depth + 1);
    if (found) return found;
  }
  return undefined;
}
