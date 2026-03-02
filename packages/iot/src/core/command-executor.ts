/**
 * Generic command executor for device drivers
 */
import type { IDeviceDriver } from "../driver/driver-base";
import type { ITransportAdapter } from "../transport/interface";

export interface ICommandExecutor {
  execute<T = unknown>(command: string | object): Promise<T>;
  destroy(): Promise<void>;
}

export class CommandExecutor implements ICommandExecutor {
  constructor(
    private readonly driver: IDeviceDriver,
    private readonly transport: ITransportAdapter,
  ) {
    this.driver.initialize(this.transport);
  }

  async execute<T = unknown>(command: string | object): Promise<T> {
    const result = await this.driver.execute<T>(command);

    if (!result.success) {
      throw result.error ?? new Error("Command execution failed");
    }

    return result.data as T;
  }

  async destroy(): Promise<void> {
    await this.driver.destroy();
  }
}
