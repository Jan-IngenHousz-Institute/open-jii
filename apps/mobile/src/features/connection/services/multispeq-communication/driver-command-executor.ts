import type { ITransportAdapter } from "@repo/iot";
import { MultispeqDriver } from "@repo/iot";

export interface ExecuteOptions {
  /** Override the response timeout (ms) for this command. */
  timeoutMs?: number;
}

export interface IMultispeqCommandExecutor {
  execute(command: string | object, options?: ExecuteOptions): Promise<string | object>;
  /** Abort the in-flight command (sends `-1+` and rejects it as cancelled). */
  cancel(): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Adapts the shared `@repo/iot` `MultispeqDriver` to the app's command-executor
 * contract: unwraps `CommandResult` to raw data (throwing on failure) and
 * exposes a preemptive `cancel()`. All framing, command queueing, dynamic
 * timeout sizing and cancel-on-timeout behaviour live in the driver — there is
 * no app-side reimplementation. See OJD-1565.
 */
class DriverCommandExecutor implements IMultispeqCommandExecutor {
  constructor(private readonly driver: MultispeqDriver) {}

  async execute(command: string | object, options?: ExecuteOptions): Promise<string | object> {
    const result = await this.driver.execute(command, options);
    if (!result.success) {
      throw result.error ?? new Error("Command failed");
    }
    return (result.data ?? "") as string | object;
  }

  cancel(): Promise<void> {
    return this.driver.cancel();
  }

  destroy(): Promise<void> {
    return this.driver.destroy();
  }
}

/** Build a command executor backed by the shared driver over the given transport. */
export function createDriverCommandExecutor(
  transport: ITransportAdapter,
): IMultispeqCommandExecutor {
  const driver = new MultispeqDriver();
  void driver.initialize(transport);
  return new DriverCommandExecutor(driver);
}
