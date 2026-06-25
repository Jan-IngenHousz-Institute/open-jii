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
  /**
   * Background/maintenance command (e.g. battery polling). The store keeps
   * these off the measurement-facing UI state so they never reset the elapsed
   * timer / estimate or surface their timeout as a measurement error. No effect
   * on the driver itself.
   */
  background?: boolean;
}

/**
 * Live progress of an in-flight command. A MultispeQ runs a protocol silently
 * and returns ONE response at the end, so `rx chunk`s are fragments of that
 * final burst — `chunks`/`bytes` climb while the reply transfers, not during
 * the measurement itself. The measuring phase is conveyed by elapsed time
 * against an estimate (see the UI), not by this stream. Hence there is
 * deliberately no chunk-silence watchdog: silence is normal mid-measurement.
 */
export interface CommandProgress {
  /** "sent" once the command is on the wire; "receiving" as the reply streams in. */
  phase: "sent" | "receiving";
  /** rx fragments seen so far (final-response transfer). */
  chunks: number;
  /** total characters received so far. */
  bytes: number;
  /** ms since the command was sent. */
  elapsedMs: number;
  /** Epoch ms of the most recent tx/rx event — drives a "last signal Xs ago" readout. */
  lastEventAt: number;
}

export type CommandProgressListener = (progress: CommandProgress) => void;

export interface IMultispeqCommandExecutor {
  execute(command: string | object, options?: ExecuteOptions): Promise<string | object>;
  /** Abort the in-flight command (sends `-1+` and rejects it as cancelled). */
  cancel(): Promise<void>;
  /**
   * Subscribe to live progress of the in-flight command. Returns an
   * unsubscribe function. Emissions are throttled so a chatty transfer can't
   * flood the React Native bridge.
   */
  onProgress(listener: CommandProgressListener): () => void;
  destroy(): Promise<void>;
}

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
  /**
   * Resolves once the driver has been initialized. `initialize()` is currently
   * synchronous, but the interface allows it to be async (handshake/probe), so
   * every public op awaits this first — that keeps execute/cancel/destroy from
   * racing setup and turns any init failure into a controlled command error
   * rather than an unhandled rejection.
   */
  private readonly initPromise: Promise<void>;
  private activeTrace: Trace | null = null;

  // Per-chunk events would bloat the wide event on long measurements —
  // aggregate them and attach one "rx" summary on message completion.
  private chunkCount = 0;

  // Live-progress state for the in-flight command. `bytes`/`cmdStartedAt` are
  // reset on each `tx`; `lastEmitAt` throttles "receiving" emissions.
  private readonly progressListeners = new Set<CommandProgressListener>();
  private bytes = 0;
  private cmdStartedAt = 0;
  private lastEmitAt = 0;

  // execute() callers can overlap (a battery poll and a measurement), but the
  // driver runs them one at a time. `activeTrace` is a single field, so setting
  // it eagerly per-call let a later call clobber the trace of the command still
  // on the wire — cross-contaminating events. Chain runs so trace ownership is
  // handed over only when the previous command settles, matching the driver's
  // serial execution.
  private commandTail: Promise<unknown> = Promise.resolve();

  constructor(transport: ITransportAdapter) {
    this.driver = new MultispeqDriver(this.createBridgeLogger());
    // `initialize()` may return void or a promise; normalize so callers can
    // always await it. Errors are swallowed here and re-surface per-command.
    this.initPromise = Promise.resolve(this.driver.initialize(transport));
    // A mid-scan disconnect (surfaced by the transport the instant the OS
    // reports it) aborts the in-flight command immediately instead of hanging
    // until its timeout. User-cancel is a separate path (it sets isCancelled).
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
        // Command is on the wire — start the clock and announce "sent".
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
  private emitProgress(phase: CommandProgress["phase"], force: boolean): void {
    if (this.progressListeners.size === 0) return;
    const now = Date.now();
    if (!force && now - this.lastEmitAt < PROGRESS_THROTTLE_MS) return;
    this.lastEmitAt = now;
    const progress: CommandProgress = {
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

  onProgress(listener: CommandProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  async execute(command: string | object, options?: ExecuteOptions): Promise<string | object> {
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
    options?: ExecuteOptions,
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
      return (result.data ?? "") as string | object;
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

  destroy(): Promise<void> {
    return this.initPromise.then(() => this.driver.destroy());
  }
}

/** Build a command executor backed by the shared driver over the given transport. */
export function createDriverCommandExecutor(
  transport: ITransportAdapter,
): IMultispeqCommandExecutor {
  return new DriverCommandExecutor(transport);
}
