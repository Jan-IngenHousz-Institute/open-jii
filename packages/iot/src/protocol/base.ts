/**
 * Device protocol interface - handles device-specific command/response patterns
 */
import type { ITransportAdapter } from "../transport/interface";

/** Command execution result */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  checksum?: string;
}

/** Abstract device protocol interface */
export interface IDeviceProtocol {
  /** Initialize protocol with a transport adapter */
  initialize(transport: ITransportAdapter): void;

  /** Execute a command and return the result */
  execute<T = unknown>(command: string | object): Promise<CommandResult<T>>;

  /** Get device information (battery, version, etc.) */
  getDeviceInfo?(): Promise<Record<string, unknown>>;

  /** Cleanup and destroy protocol */
  destroy(): Promise<void>;
}

/** Base class for device protocols */
export abstract class DeviceProtocol implements IDeviceProtocol {
  protected transport?: ITransportAdapter;
  protected initialized = false;

  initialize(transport: ITransportAdapter): void {
    this.transport = transport;
    this.initialized = true;
  }

  abstract execute<T = unknown>(command: string | object): Promise<CommandResult<T>>;

  async destroy(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
    }
    this.initialized = false;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.transport) {
      throw new Error("Protocol not initialized. Call initialize() first.");
    }
  }
}
