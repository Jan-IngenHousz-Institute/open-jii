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

import type {
  DeviceIdentity,
  IDeviceDriver,
  ITransportAdapter,
  Logger as IotLogger,
  SensorFamily,
} from "@repo/iot";
import { identifyDevice } from "@repo/iot";

/** Namespace used until the handshake resolves which family answered. */
const log = createLogger("device");

/** Per-probe reply timeout, matching the web host's `useIotConnections`. */
const PROBE_TIMEOUT_MS = 2000;

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

/** Options for building an executor over an already-connected transport. */
export interface IdentifiedCommandExecutorOptions {
  /**
   * Skip the probe and bind this family directly. Used by transports that
   * already know what they are (mock devices) and by tests that assert a
   * specific driver's framing.
   */
  assumeFamily?: SensorFamily;
  /** Override the per-probe reply timeout. */
  probeTimeoutMs?: number;
}

/**
 * Adapts a `@repo/iot` driver to the app's command-executor contract: unwraps
 * `CommandResult` to raw data (throwing on failure) and exposes a preemptive
 * `cancel()`. All framing, command queueing, dynamic timeout sizing and
 * cancel-on-timeout behaviour live in the driver; there is no app-side
 * reimplementation. See OJD-1565.
 *
 * Which driver is bound is decided by the `identifyDevice` handshake rather
 * than assumed, so an Ambit or miniPAR on the same USB/Bluetooth transport gets
 * its own driver and reports its own family. This mirrors what the web host has
 * done since #1791 (`useIotConnections`); mobile previously hardcoded the
 * MultispeQ driver, which made every device report `family: "multispeq"`.
 *
 * Each execute() is captured as ONE wide trace event (`<family>.command`): the
 * driver's debug logs are routed into the trace via a bridge logger, so a long
 * measurement produces a single fat entry (tx, rx summary, timings) instead of
 * hundreds of per-chunk debug lines.
 */
export class IdentifiedCommandExecutor implements DeviceCommandExecutor {
  /** Bound by the handshake; every public op awaits `initPromise` first. */
  private driver: IDeviceDriver | undefined;
  /** Family of record from the probe; the driver must not overwrite it. */
  private family: SensorFamily = "generic";
  /** Identity the probe resolved, merged under each live `getIdentity()`. */
  private probeIdentity: DeviceIdentity | undefined;
  /** Namespaced to the resolved family once known, so logs name the real device. */
  private familyLog: ReturnType<typeof createLogger> | undefined;
  /**
   * Resolves once the handshake has picked a driver and initialized it. Every
   * public op awaits this first; that keeps execute/cancel/destroy from racing
   * setup and turns any init failure into a controlled command error rather
   * than an unhandled rejection.
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

  constructor(transport: ITransportAdapter, options?: IdentifiedCommandExecutorOptions) {
    // `identifyDevice` probes, picks the connector and initializes it against
    // this transport. Errors are swallowed here and re-surface per-command.
    this.initPromise = this.identify(transport, options);
    // A transport-reported disconnect aborts the in-flight command at once;
    // user-cancel is a separate path (it sets isCancelled). The driver may not
    // be bound yet if the cable is pulled mid-handshake, hence the guard.
    transport.onStatusChanged((isConnected) => {
      if (!isConnected) void this.driver?.cancel?.();
    });
  }

  /**
   * Run the identification handshake and adopt whatever answered. The probe's
   * family is authoritative: fallback connectors self-report "generic" and must
   * not overwrite a probe-resolved family.
   */
  private async identify(
    transport: ITransportAdapter,
    options?: IdentifiedCommandExecutorOptions,
  ): Promise<void> {
    const { family, info, connector } = await identifyDevice(transport, {
      assumeFamily: options?.assumeFamily,
      probeTimeoutMs: options?.probeTimeoutMs ?? PROBE_TIMEOUT_MS,
      logger: this.createBridgeLogger(),
    });
    this.driver = connector;
    this.family = family;
    this.probeIdentity = info;
    this.familyLog = createLogger(family);
    this.familyLog.info("identified", { family, name: info.name });
  }

  /** The driver, once the handshake has bound one. */
  private get boundDriver(): IDeviceDriver {
    if (!this.driver) throw new Error("Device is not identified yet");
    return this.driver;
  }

  /** Family-namespaced logger once known, the neutral one before that. */
  private get activeLog(): ReturnType<typeof createLogger> {
    return this.familyLog ?? log;
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
        if (!record(msg, args)) this.activeLog.debug(msg, args[0] as LogFields | undefined);
      },
      info: (msg, ...args) => {
        if (!record(msg, args)) this.activeLog.info(msg, args[0] as LogFields | undefined);
      },
      warn: (msg, ...args) => {
        record(msg, args);
        this.activeLog.warn(msg, args[0] as LogFields | undefined);
      },
      error: (msg, ...args) => {
        record(msg, args);
        this.activeLog.error(msg, args[0] as LogFields | undefined);
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
    const trace = startTrace(`${this.family}.command`, `${this.family}-cmd-${++commandSeq}`);
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
        this.activeLog.info("measuring", { elapsedMs: Date.now() - this.cmdStartedAt });
      }
    }, HEARTBEAT_MS);

    try {
      const result = await this.boundDriver.execute(command, options);
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
    return this.initPromise.then(() => this.boundDriver.cancel?.());
  }

  /**
   * Re-reads the driver's identity each call so live fields (battery) stay
   * fresh, layered over what the probe resolved. `family` is pinned to the
   * probe's answer: a fallback connector self-reports "generic" and would
   * otherwise erase a real classification.
   */
  async getIdentity(): Promise<DeviceIdentity> {
    await this.initPromise;
    const driver = this.boundDriver;
    const live = await driver.getDeviceIdentity?.();
    return {
      ...this.probeIdentity,
      ...live,
      family: this.family,
      raw: { ...this.probeIdentity?.raw, ...live?.raw },
    };
  }

  destroy(): Promise<void> {
    return this.initPromise.then(() => this.boundDriver.destroy());
  }
}

/**
 * Build a command executor over the given transport, probing to decide which
 * driver to bind. Pass `assumeFamily` only when the caller already knows.
 */
export function createIdentifiedCommandExecutor(
  transport: ITransportAdapter,
  options?: IdentifiedCommandExecutorOptions,
): DeviceCommandExecutor {
  return new IdentifiedCommandExecutor(transport, options);
}
