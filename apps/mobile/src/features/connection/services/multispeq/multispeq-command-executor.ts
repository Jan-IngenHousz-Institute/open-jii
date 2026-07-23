import type {
  DeviceCommandExecuteOptions,
  DeviceCommandExecutor,
  DeviceCommandProgress,
  DeviceCommandProgressListener,
} from "~/features/connection/services/device-command-executor";
import type { LogFields } from "~/shared/observability/logger";
import { createLogger } from "~/shared/observability/logger";
import type { Trace } from "~/shared/observability/trace";
import { startTrace } from "~/shared/observability/trace";

import type { DeviceIdentity, ITransportAdapter, Logger as IotLogger } from "@repo/iot";
import { MultispeqDriver } from "@repo/iot";

const log = createLogger("multispeq");

let commandSeq = 0;

/** Minimum gap (ms) between throttled "receiving" emissions. */
const PROGRESS_THROTTLE_MS = 100;

/**
 * A MultispeQ runs silently, so a long protocol emits nothing between `tx` and
 * the final reply. Log a coarse heartbeat while waiting so the logs prove the
 * app is still alive. Sub-second commands (battery, hello) finish well before
 * the first tick, so this is measurement-only noise-free.
 */
const HEARTBEAT_MS = 15_000;

/**
 * Adapts the shared `@repo/iot` `MultispeqDriver` to the app's command-executor
 * contract: unwraps `CommandResult` to raw data (throwing on failure) and
 * exposes a preemptive `cancel()`. All framing, command queueing, dynamic
 * timeout sizing and cancel-on-timeout behaviour live in the driver; there is
 * no app-side reimplementation. See OJD-1565.
 *
 * Each execute() is captured as ONE wide trace event (`multispeq.command`):
 * the driver's debug logs are routed into the trace via a bridge logger, so a
 * long measurement produces a single fat entry (tx, rx summary, timings)
 * instead of hundreds of per-chunk debug lines.
 */
export class MultispeqCommandExecutor implements DeviceCommandExecutor {
  private readonly driver: MultispeqDriver;
  /**
   * Resolves once the driver has been initialized. `initialize()` is currently
   * synchronous, but the interface allows it to be async (handshake/probe), so
   * every public op awaits this first; that keeps execute/cancel/destroy from
   * racing setup and turns any init failure into a controlled command error
   * rather than an unhandled rejection.
   */
  private readonly initPromise: Promise<void>;
  private activeTrace: Trace | null = null;

  // Per-chunk events would bloat the wide event on long measurements, so
  // aggregate them and attach one "rx" summary on message completion.
  private chunkCount = 0;

  // Live-progress state for the in-flight command. `bytes`/`cmdStartedAt` are
  // reset on each `tx`; `lastEmitAt` throttles "receiving" emissions.
  private readonly progressListeners = new Set<DeviceCommandProgressListener>();
  private bytes = 0;
  private cmdStartedAt = 0;
  private lastEmitAt = 0;

  // Callers can overlap (battery poll vs measurement) but the driver runs them
  // serially; chain runs so each command owns `activeTrace` only while on the
  // wire, instead of a later call clobbering the in-flight command's trace.
  private commandTail: Promise<unknown> = Promise.resolve();

  constructor(transport: ITransportAdapter) {
    this.driver = new MultispeqDriver(this.createBridgeLogger());
    // `initialize()` may return void or a promise; normalize so callers can
    // always await it. Errors are swallowed here and re-surface per-command.
    this.initPromise = Promise.resolve(this.driver.initialize(transport));
    // A transport-reported disconnect aborts the in-flight command at once;
    // user-cancel is a separate path (it sets isCancelled).
    transport.onStatusChanged((isConnected) => {
      if (!isConnected) void this.driver.cancel();
    });
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

      if (msg === "tx") {
        // Command is on the wire; start the clock and announce "sent".
        this.cmdStartedAt = Date.now();
        this.bytes = 0;
        this.lastEmitAt = 0;
        trace.event(msg, fields);
        this.emitProgress("sent", true);
        return true;
      }
      if (msg === "rx chunk") {
        this.chunkCount += 1;
        this.bytes += typeof fields?.chars === "number" ? fields.chars : 0;
        this.emitProgress("receiving", false);
        return true;
      }
      if (msg === "rx complete") {
        trace.event("rx", { ...fields, chunks: this.chunkCount });
        this.emitProgress("receiving", true);
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

  /**
   * Notify progress listeners. "receiving" emissions are throttled to
   * PROGRESS_THROTTLE_MS; "sent" and the final "rx complete" pass `force`.
   */
  private emitProgress(phase: DeviceCommandProgress["phase"], force: boolean): void {
    if (this.progressListeners.size === 0) return;
    const now = Date.now();
    if (!force && now - this.lastEmitAt < PROGRESS_THROTTLE_MS) return;
    this.lastEmitAt = now;
    const progress: DeviceCommandProgress = {
      phase,
      chunks: this.chunkCount,
      bytes: this.bytes,
      elapsedMs: this.cmdStartedAt ? now - this.cmdStartedAt : 0,
      lastEventAt: now,
    };
    this.progressListeners.forEach((listener) => {
      try {
        listener(progress);
      } catch {
        // A bad listener must never break command execution.
      }
    });
  }

  onProgress(listener: DeviceCommandProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  async execute(
    command: string | object,
    options?: DeviceCommandExecuteOptions,
  ): Promise<string | object> {
    // Hand trace ownership over serially (see `commandTail`). The chain must
    // survive a failed command, so both branches continue to the next run.
    const run = this.commandTail.then(
      () => this.runCommand(command, options),
      () => this.runCommand(command, options),
    );
    this.commandTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runCommand(
    command: string | object,
    options?: DeviceCommandExecuteOptions,
  ): Promise<string | object> {
    // Ensure the driver finished initializing before sending anything.
    await this.initPromise;
    const trace = startTrace("multispeq.command", `multispeq-cmd-${++commandSeq}`);
    this.activeTrace = trace;
    this.chunkCount = 0;
    this.bytes = 0;
    this.cmdStartedAt = 0;
    this.lastEmitAt = 0;

    // Heartbeat: a silent multi-minute protocol logs nothing between tx and the
    // final reply, so emit elapsed every HEARTBEAT_MS to prove liveness. Guarded
    // on `cmdStartedAt` so it stays quiet until the command is actually on the
    // wire; cleared in `finally`.
    const heartbeat = setInterval(() => {
      if (this.cmdStartedAt) {
        log.info("measuring", { elapsedMs: Date.now() - this.cmdStartedAt });
      }
    }, HEARTBEAT_MS);

    try {
      const result = await this.driver.execute(command, options);
      if (!result.success) {
        throw result.error ?? new Error("Command failed");
      }
      trace.end("ok");
      return result.data ?? "";
    } catch (error) {
      trace.end("error", { err: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      clearInterval(heartbeat);
      this.activeTrace = null;
    }
  }

  cancel(): Promise<void> {
    return this.initPromise.then(() => this.driver.cancel());
  }

  getIdentity(): Promise<DeviceIdentity> {
    return this.initPromise.then(() => this.driver.getDeviceIdentity());
  }

  destroy(): Promise<void> {
    return this.initPromise.then(() => this.driver.destroy());
  }
}

/** Build a command executor backed by the shared driver over the given transport. */
export function createMultispeqCommandExecutor(
  transport: ITransportAdapter,
): DeviceCommandExecutor {
  return new MultispeqCommandExecutor(transport);
}
