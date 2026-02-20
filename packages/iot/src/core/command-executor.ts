/**
 * Generic command executor for device protocols
 */
import type { IDeviceProtocol } from "../protocol/base";
import type { ITransportAdapter } from "../transport/interface";

export interface ICommandExecutor {
  execute<T = unknown>(command: string | object): Promise<T>;
  destroy(): Promise<void>;
}

export class CommandExecutor implements ICommandExecutor {
  constructor(
    private readonly protocol: IDeviceProtocol,
    private readonly transport: ITransportAdapter,
  ) {
    this.protocol.initialize(this.transport);
  }

  async execute<T = unknown>(command: string | object): Promise<T> {
    const result = await this.protocol.execute<T>(command);

    if (!result.success) {
      throw result.error ?? new Error("Command execution failed");
    }

    return result.data as T;
  }

  async destroy(): Promise<void> {
    await this.protocol.destroy();
  }
}
