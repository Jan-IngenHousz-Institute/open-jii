/**
 * MiniPAR driver: dual-mode ESP32 serial console.
 *
 * LINE mode: a plain string command replies with raw text. Some replies are
 * printed without a trailing newline (hello), so a short RX quiet window
 * completes a reply that never sees one. JSON mode: a protocol array/object
 * is sent in one write and the firmware replies with a JSON envelope of
 * `device_*` header fields plus a `sample` array, terminated by the constant
 * `7A1E3AA1` footer.
 */
import type { DeviceIdentity, SensorFamily } from "../../core/families";
import type { ITransportAdapter } from "../../transport/interface";
import { collectReply, parseOpenJiiEnvelope } from "../../utils/framing/openjii-envelope";
import type { RxCollectorHooks } from "../../utils/framing/openjii-envelope";
import type { Logger } from "../../utils/logger/logger";
import { DeviceDriver } from "../driver-base";
import type { CommandResult, ExecuteOptions } from "../driver-base";
import { MINIPAR_COMMANDS } from "./commands";
import { MINIPAR_FRAMING } from "./config";
import type { MiniParDriverConfig } from "./config";
import type { MiniParStreamEvents } from "./interface";

/** RX silence that completes a LINE-mode reply lacking a newline. */
const LINE_QUIET_MS = 200;

export class MiniParDriver extends DeviceDriver<MiniParStreamEvents> {
  override readonly family: SensorFamily = "minipar";

  private readonly defaultTimeoutMs: number;
  private readonly protocolTimeoutMs: number;

  private rxBuffer = "";
  private onChunk: (() => void) | undefined;

  constructor(config?: MiniParDriverConfig, logger?: Logger) {
    super(logger);
    this.defaultTimeoutMs = config?.timeoutMs ?? MINIPAR_FRAMING.DEFAULT_TIMEOUT;
    this.protocolTimeoutMs = config?.protocolTimeoutMs ?? MINIPAR_FRAMING.PROTOCOL_TIMEOUT;
  }

  override initialize(transport: ITransportAdapter): void {
    void super.initialize(transport);
    this.rxBuffer = "";
    transport.onDataReceived((data) => this.handleDataReceived(data));
  }

  private handleDataReceived(data: string): void {
    this.rxBuffer += data;
    if (this.rxBuffer.length > this.maxBufferSize) {
      this.log.error("MiniPAR receive buffer exceeded max size, discarding data");
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

  /** Buffer until `isComplete` or a quiet window with data; reject on empty timeout. */
  private collect(
    isComplete: (buffer: string) => boolean,
    timeoutMs: number,
    quietMs?: number,
  ): Promise<string> {
    return collectReply(this.rxHooks, { isComplete, timeoutMs, quietMs });
  }

  async execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    return this.commandQueue.enqueue(async () => {
      try {
        if (!this.transport) {
          throw new Error("Transport not initialized");
        }
        this.rxBuffer = "";

        if (typeof command === "string") {
          await this.transport.send(`${command.trim()}${MINIPAR_FRAMING.LINE_ENDING}`);
          const reply = await this.collect(
            (buffer) => /[^\s]\r?\n/.test(buffer),
            options?.timeoutMs ?? this.defaultTimeoutMs,
            LINE_QUIET_MS,
          );
          // The firmware echoes a blank line around LINE replies.
          const text = reply
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .join("\n");
          void this.emitter.emit("receivedLine", text);
          if (text.startsWith("error:")) {
            throw new Error(`MiniPAR replied ${text}`);
          }
          return { success: true, data: text as T };
        }

        // JSON protocol: one write, envelope + footer reply.
        await this.transport.send(`${JSON.stringify(command)}${MINIPAR_FRAMING.LINE_ENDING}`);
        const reply = await this.collect(
          (buffer) => parseOpenJiiEnvelope(buffer) !== null,
          options?.timeoutMs ?? this.protocolTimeoutMs,
        );
        const envelope = parseOpenJiiEnvelope(reply);
        if (!envelope) {
          void this.emitter.emit("parseError", { line: reply, error: "incomplete envelope" });
          throw new Error("MiniPAR reply was not a complete measurement envelope");
        }
        void this.emitter.emit("receivedEnvelope", envelope);
        return {
          success: true,
          data: envelope as T,
          checksum: MINIPAR_FRAMING.FRAME_FOOTER,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });
  }

  /** Identity from `hello` (`MiniPAR,<version>,<firmware>` or the JSON-mode form). */
  async getDeviceIdentity(): Promise<DeviceIdentity> {
    const result = await this.execute<string>(MINIPAR_COMMANDS.HELLO, { timeoutMs: 3_000 });
    const text = typeof result.data === "string" ? result.data : "";

    let name: string | undefined;
    let firmwareVersion: string | undefined;
    const csv = /^minipar\s*,\s*(?<version>[^,\s]+)\s*(?:,\s*(?<firmware>[^,\s]+))?/im.exec(text);
    if (csv) {
      name = "MiniPAR";
      firmwareVersion = csv.groups?.firmware ?? csv.groups?.version;
    } else {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.device === "string") name = parsed.device;
        if (typeof parsed.version === "string") firmwareVersion = parsed.version;
      } catch {
        // unrecognized hello; identity stays minimal
      }
    }

    // Best-effort persisted name; the default is "NoName".
    const named = await this.execute<string>(MINIPAR_COMMANDS.GET_NAME, { timeoutMs: 2_000 });
    const deviceName =
      named.success && typeof named.data === "string" && named.data.trim() !== ""
        ? named.data.trim()
        : undefined;

    return {
      family: this.family,
      name: deviceName && !/noname/i.test(deviceName) ? deviceName : name,
      firmwareVersion,
      raw: { helloReply: text, deviceName },
    };
  }

  override async destroy(): Promise<void> {
    this.rxBuffer = "";
    this.onChunk = undefined;
    await super.destroy();
  }
}
