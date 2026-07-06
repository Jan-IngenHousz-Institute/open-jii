/**
 * Device driver interface - handles device-specific command/response patterns
 */
import type { DeviceIdentity, SensorFamily } from "../core/families";
import type { ITransportAdapter } from "../transport/interface";
import { CommandQueue } from "../utils/command-queue/command-queue";
import { Emitter } from "../utils/emitter/emitter";
import { stringifyIfObject } from "../utils/framing/framing";
import type { Logger } from "../utils/logger/logger";
import { defaultLogger } from "../utils/logger/logger";

/** Command execution result */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  checksum?: string;
}

/** Per-call execution options */
export interface ExecuteOptions {
  /**
   * Override the response timeout (ms) for this command. When omitted the
   * driver picks a timeout itself (e.g. sized to a measurement protocol's
   * estimated runtime).
   */
  timeoutMs?: number;
}

/**
 * Live progress of an in-flight command. Kept shape-identical to the mobile
 * app's driver-command-executor contract.
 */
export interface CommandProgress {
  /** "sent" once the command is on the wire; "receiving" as the reply streams in. */
  phase: "sent" | "receiving";
  /** rx fragments so far */
  chunks: number;
  /** chars received so far */
  bytes: number;
  /** since tx */
  elapsedMs: number;
  /** epoch ms of last tx/rx event */
  lastEventAt: number;
}

export type CommandProgressListener = (progress: CommandProgress) => void;

/** Abstract device driver interface */
export interface IDeviceDriver {
  /** Sensor family this driver speaks (optional for structural mocks). */
  readonly family?: SensorFamily;

  /**
   * Initialize driver with a transport adapter.
   * May be async (e.g. to probe device capabilities during handshake).
   * Callers should always `await` the result.
   */
  initialize(transport: ITransportAdapter): void | Promise<void>;

  /** Execute a command and return the result */
  execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>>;

  /** Get device information (battery, version, etc.) */
  getDeviceInfo?(): Promise<Record<string, unknown>>;

  /** Identify the connected device (family, name, battery, raw info). */
  getDeviceIdentity?(): Promise<DeviceIdentity>;

  /** Abort the in-flight command, if any. No-op when idle. */
  cancel?(): Promise<void>;

  /** Subscribe to live command progress. Returns an unsubscribe function. */
  onProgress?(listener: CommandProgressListener): () => void;

  /** Cleanup and destroy driver */
  destroy(): Promise<void>;
}

/** Default maximum receive buffer size (1 MB) before discarding data */
export const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024;

/** Default minimum gap (ms) between throttled "receiving" progress emissions. */
export const DEFAULT_PROGRESS_THROTTLE_MS = 100;

/** Base-class construction options. */
export interface DeviceDriverOptions {
  /** Minimum gap (ms) between throttled "receiving" progress emissions. */
  progressThrottleMs?: number;
}

/** Truncate long commands (e.g. full protocol JSON) so logs stay readable. */
function summarizeCommand(commandStr: string, maxLength = 120): string {
  if (commandStr.length <= maxLength) return commandStr;
  return `${commandStr.slice(0, maxLength)}… (${commandStr.length} chars)`;
}

/**
 * Base class for device drivers.
 *
 * Provides common infrastructure that every driver needs:
 * - transport lifecycle (initialize / destroy / ensureInitialized)
 * - typed event emitter
 * - command queue (serializes execute() calls so responses are never mismatched)
 * - receive-buffer overflow protection
 * - execute() template method (send, wait for one response event, decode)
 * - in-flight cancel and live progress reporting
 *
 * Subclasses supply the `EventMap` type parameter for their own events and
 * customise the send/receive cycle via the family hooks (encodeCommand,
 * responseEvent, decodeResponse, beforeSend, resolveTimeoutMs, ...). The
 * hooks carry working defaults instead of being abstract so that existing
 * structural subclasses keep compiling; concrete drivers override them.
 */
export abstract class DeviceDriver<
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> implements IDeviceDriver
{
  protected transport?: ITransportAdapter;
  protected initialized = false;

  /** Override to change the maximum receive buffer size per driver */
  protected maxBufferSize = DEFAULT_MAX_BUFFER_SIZE;

  /** Logger instance, injected via constructor; defaults to console */
  protected readonly log: Logger;

  /** Typed event emitter; subclasses emit/listen on their own event map */
  protected readonly emitter: Emitter<EventMap>;

  /** Serializes execute() calls so only one command is in-flight at a time */
  protected readonly commandQueue = new CommandQueue();

  /** Sensor family this driver speaks; concrete drivers override. */
  readonly family: SensorFamily = "generic";

  /** Base response timeout (ms); subclass constructors set their own. */
  protected defaultTimeoutMs = 10_000;

  /** Message used when a response wait times out; subclasses may override. */
  protected timeoutErrorMessage = "Command timeout";

  /** Emitter event carrying the device reply; concrete drivers override. */
  protected readonly responseEvent: keyof EventMap = "receivedResponse" as keyof EventMap;

  /** Aborts the in-flight waitForResponse(), if any. Set while a command waits. */
  private pendingAbort?: () => void;

  private readonly progressThrottleMs: number;
  private readonly progressListeners = new Set<CommandProgressListener>();
  private progressChunks = 0;
  private progressBytes = 0;
  private progressStartedAt = 0;
  private lastProgressEmitAt = 0;

  constructor(logger?: Logger, options?: DeviceDriverOptions) {
    this.log = logger ?? defaultLogger;
    this.emitter = new Emitter<EventMap>(this.log);
    this.progressThrottleMs = options?.progressThrottleMs ?? DEFAULT_PROGRESS_THROTTLE_MS;
  }

  initialize(transport: ITransportAdapter): void | Promise<void> {
    this.transport = transport;
    this.initialized = true;
  }

  /**
   * Template method: enqueue, encode, send, await one response event, decode.
   * Subclasses customise the cycle through the protected hooks rather than
   * overriding execute() itself.
   */
  async execute<T = unknown>(
    command: string | object,
    options?: ExecuteOptions,
  ): Promise<CommandResult<T>> {
    this.ensureInitialized();

    const timeoutMs = this.resolveTimeoutMs(command, options);

    // Serialize commands so responses are never mismatched
    return this.commandQueue.enqueue(async () => {
      const startedAt = Date.now();
      try {
        if (!this.transport) {
          throw new Error("Transport not initialized");
        }

        this.beforeSend(command);
        this.log.debug("tx", { command: summarizeCommand(stringifyIfObject(command)), timeoutMs });
        this.markCommandSent();
        await this.transport.send(this.encodeCommand(command));

        // Wait for response
        const payload = await this.waitForResponse(timeoutMs);

        this.log.debug("command completed", { elapsedMs: Date.now() - startedAt, timeoutMs });
        return this.decodeResponse<T>(payload);
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

  // ─── Family hooks ─────────────────────────────────────────────────

  /** Encode a command into the full wire payload (including line ending). */
  protected encodeCommand(command: string | object): string {
    return stringifyIfObject(command);
  }

  /** Decode the raw response-event payload into a CommandResult. */
  protected decodeResponse<T>(payload: unknown): CommandResult<T> {
    return { success: true, data: payload as T } as CommandResult<T>;
  }

  /** Pick the response timeout for a command; subclasses may size it dynamically. */
  protected resolveTimeoutMs(command: string | object, options?: ExecuteOptions): number {
    void command;
    return options?.timeoutMs ?? this.defaultTimeoutMs;
  }

  /** Hook invoked just before a command is sent (e.g. rx-buffer resync). */
  protected beforeSend(command: string | object): void {
    void command;
  }

  /** Hook invoked when a response wait times out (e.g. warn + device-side cancel). */
  protected onResponseTimeout(timeoutMs: number): void {
    void timeoutMs;
  }

  /** Fire-and-forget device-side abort (e.g. MultispeQ "-1+"); default no-op. */
  protected sendCancelToDevice(): void {
    // no device-side cancel by default
  }

  // ─── Provided machinery ───────────────────────────────────────────

  /** Wait for a single responseEvent emission, a timeout, or an abort. */
  protected waitForResponse(timeoutMs: number): Promise<EventMap[keyof EventMap]> {
    return new Promise((resolve, reject) => {
      const event = this.responseEvent;

      const cleanup = () => {
        clearTimeout(timeout);
        this.emitter.off(event, handler);
        this.pendingAbort = undefined;
      };

      const timeout = setTimeout(() => {
        cleanup();
        this.onResponseTimeout(timeoutMs);
        reject(new Error(this.timeoutErrorMessage));
      }, timeoutMs);

      const handler = (payload: EventMap[keyof EventMap]) => {
        cleanup();
        resolve(payload);
      };

      // Let cancel() abort this wait. The device-side abort is sent by
      // cancel() itself so it reaches the device immediately, bypassing the
      // command queue.
      this.pendingAbort = () => {
        cleanup();
        reject(new Error("Command cancelled"));
      };

      this.emitter.once(event, handler);
    });
  }

  /**
   * Abort the in-flight command: best-effort device-side cancel plus reject
   * the pending execute() with "Command cancelled". No-op when idle, so an
   * idle cancel never emits a stray abort whose ack could be mismatched to a
   * later command.
   */
  async cancel(): Promise<void> {
    const abort = this.pendingAbort;
    if (!abort) return;
    this.log.debug("cancel: aborting in-flight command");
    this.pendingAbort = undefined;
    this.sendCancelToDevice();
    abort();
    await Promise.resolve();
  }

  /**
   * Subscribe to live progress of the in-flight command; returns an
   * unsubscribe function. "receiving" emissions are throttled to
   * progressThrottleMs, but phase edges ("sent", first rx chunk) always emit.
   */
  onProgress(listener: CommandProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /** Subclass data handlers call this per rx fragment to drive progress. */
  protected notifyRxChunk(chars: number): void {
    const firstChunk = this.progressChunks === 0;
    this.progressChunks += 1;
    this.progressBytes += chars;
    this.emitProgress("receiving", firstChunk);
  }

  private markCommandSent(): void {
    this.progressChunks = 0;
    this.progressBytes = 0;
    this.progressStartedAt = Date.now();
    this.lastProgressEmitAt = 0;
    this.emitProgress("sent", true);
  }

  private emitProgress(phase: CommandProgress["phase"], force: boolean): void {
    if (this.progressListeners.size === 0) return;
    const now = Date.now();
    if (!force && now - this.lastProgressEmitAt < this.progressThrottleMs) return;
    this.lastProgressEmitAt = now;
    const progress: CommandProgress = {
      phase,
      chunks: this.progressChunks,
      bytes: this.progressBytes,
      elapsedMs: this.progressStartedAt ? now - this.progressStartedAt : 0,
      lastEventAt: now,
    };
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch {
        // A bad listener must never break command execution.
      }
    }
  }

  async destroy(): Promise<void> {
    // Abort any in-flight command so it rejects immediately instead of
    // hanging until its (possibly multi-minute) timeout after the transport
    // is gone (OJD-1565).
    const abort = this.pendingAbort;
    this.pendingAbort = undefined;
    abort?.();
    this.progressListeners.clear();
    this.emitter.removeAllListeners();
    if (this.transport) {
      await this.transport.disconnect();
    }
    this.initialized = false;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.transport) {
      throw new Error("Driver not initialized. Call initialize() first.");
    }
  }

  /** Listen to driver events */
  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.on(event, listener);
  }

  /** Remove event listener */
  off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.off(event, listener);
  }
}
