import type { LogFields } from "~/shared/observability/logger";
import { createLogger } from "~/shared/observability/logger";
import type { Trace } from "~/shared/observability/trace";
import { startTrace } from "~/shared/observability/trace";

import type { ITransportAdapter, Logger as IotLogger } from "@repo/iot";
import { MultispeqDriver } from "@repo/iot";

const log = createLogger("multispeq");

let commandSeq = 0;

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
 *
 * Each execute() is captured as ONE wide trace event (`multispeq.command`):
 * the driver's debug logs are routed into the trace via a bridge logger, so a
 * long measurement produces a single fat entry (tx, rx summary, timings)
 * instead of hundreds of per-chunk debug lines.
 */
class DriverCommandExecutor implements IMultispeqCommandExecutor {
  private readonly driver: MultispeqDriver;
  private activeTrace: Trace | null = null;

  // Per-chunk events would bloat the wide event on long measurements —
  // aggregate them and attach one "rx" summary on message completion.
  private chunkCount = 0;

  constructor(transport: ITransportAdapter) {
    this.driver = new MultispeqDriver(this.createBridgeLogger());
    void this.driver.initialize(transport);
  }

  /**
   * Routes driver logs into the active command trace. Debug/info become trace
   * events (or fall through to the namespaced logger when no command is in
   * flight); warn/error always log AND are recorded on the trace.
   */
  private createBridgeLogger(): IotLogger {
    const record = (msg: string, args: unknown[]): boolean => {
      const trace = this.activeTrace;
      if (!trace) return false;
      const fields = args[0] as LogFields | undefined;

      if (msg === "rx chunk") {
        this.chunkCount += 1;
        return true;
      }
      if (msg === "rx complete") {
        trace.event("rx", { ...fields, chunks: this.chunkCount });
        this.chunkCount = 0;
        return true;
      }
      trace.event(msg, fields);
      return true;
    };

    return {
      debug: (msg, ...args) => {
        if (!record(msg, args)) log.debug(msg, args[0] as LogFields | undefined);
      },
      info: (msg, ...args) => {
        if (!record(msg, args)) log.info(msg, args[0] as LogFields | undefined);
      },
      warn: (msg, ...args) => {
        record(msg, args);
        log.warn(msg, args[0] as LogFields | undefined);
      },
      error: (msg, ...args) => {
        record(msg, args);
        log.error(msg, args[0] as LogFields | undefined);
      },
    };
  }

  async execute(command: string | object, options?: ExecuteOptions): Promise<string | object> {
    const trace = startTrace("multispeq.command", `multispeq-cmd-${++commandSeq}`);
    this.activeTrace = trace;
    this.chunkCount = 0;

    try {
      const result = await this.driver.execute(command, options);
      if (!result.success) {
        throw result.error ?? new Error("Command failed");
      }
      trace.end("ok");
      return (result.data ?? "") as string | object;
    } catch (error) {
      trace.end("error", { err: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      this.activeTrace = null;
    }
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
  return new DriverCommandExecutor(transport);
}
