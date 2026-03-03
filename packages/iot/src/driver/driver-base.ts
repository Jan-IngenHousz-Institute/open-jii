/**
 * Device driver interface - handles device-specific command/response patterns
 */
import type { ITransportAdapter } from "../transport/interface";
import { CommandQueue } from "../utils/command-queue/command-queue";
import { Emitter } from "../utils/emitter/emitter";
import type { Logger } from "../utils/logger/logger";
import { defaultLogger } from "../utils/logger/logger";

/** Command execution result */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  checksum?: string;
}

/** Abstract device driver interface */
export interface IDeviceDriver {
  /**
   * Initialize driver with a transport adapter.
   * May be async (e.g. to probe device capabilities during handshake).
   * Callers should always `await` the result.
   */
  initialize(transport: ITransportAdapter): void | Promise<void>;

  /** Execute a command and return the result */
  execute<T = unknown>(command: string | object): Promise<CommandResult<T>>;

  /** Get device information (battery, version, etc.) */
  getDeviceInfo?(): Promise<Record<string, unknown>>;

  /** Cleanup and destroy driver */
  destroy(): Promise<void>;
}

/** Default maximum receive buffer size (1 MB) before discarding data */
export const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024;

/**
 * Base class for device drivers.
 *
 * Provides common infrastructure that every driver needs:
 * - transport lifecycle (initialize / destroy / ensureInitialized)
 * - typed event emitter
 * - command queue (serializes execute() calls so responses are never mismatched)
 * - receive-buffer overflow protection
 *
 * Subclasses supply the `EventMap` type parameter for their own events.
 */
export abstract class DeviceDriver<
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> implements IDeviceDriver
{
  protected transport?: ITransportAdapter;
  protected initialized = false;

  /** Override to change the maximum receive buffer size per driver */
  protected maxBufferSize = DEFAULT_MAX_BUFFER_SIZE;

  /** Logger instance — injected via constructor, defaults to console */
  protected readonly log: Logger;

  /** Typed event emitter — subclasses emit/listen on their own event map */
  protected readonly emitter: Emitter<EventMap>;

  /** Serializes execute() calls so only one command is in-flight at a time */
  protected readonly commandQueue = new CommandQueue();

  constructor(logger?: Logger) {
    this.log = logger ?? defaultLogger;
    this.emitter = new Emitter<EventMap>(this.log);
  }

  initialize(transport: ITransportAdapter): void {
    this.transport = transport;
    this.initialized = true;
  }

  abstract execute<T = unknown>(command: string | object): Promise<CommandResult<T>>;

  async destroy(): Promise<void> {
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
