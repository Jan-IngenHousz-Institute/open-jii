import type {
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
  MacroRunInput,
  MacroRunnerPort,
  ProtocolCodeResolverPort,
  WorkbookRunnerPorts,
} from "@repo/workbook";

// Mobile ports for the @repo/workbook runner. The runtime auto-runs producer
// cells on forward entry; mobile's UX requires an explicit user action first
// (tap-to-scan, review-then-continue). Both are implemented as UserGates the
// ports await before doing (command) or finishing (macro) the work.

/**
 * One-shot user-consent gate. `arm()` releases a pending waiter or pre-arms
 * the next `wait()` (a tap that itself triggers the run). Abort settles the
 * waiter so a cancelled cell never leaks a promise.
 */
export class UserGate {
  private preArmed = false;
  private waiter: { release: () => void } | null = null;

  constructor(private readonly onPendingChange?: (pending: boolean) => void) {}

  get pending(): boolean {
    return this.waiter !== null;
  }

  arm(): void {
    if (this.waiter) {
      const { release } = this.waiter;
      this.waiter = null;
      this.onPendingChange?.(false);
      release();
      return;
    }
    this.preArmed = true;
  }

  reset(): void {
    this.preArmed = false;
    if (this.waiter) {
      this.waiter = null;
      this.onPendingChange?.(false);
    }
  }

  wait(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Error("Measurement cancelled"));
    if (this.preArmed) {
      this.preArmed = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        if (this.waiter?.release === release) {
          this.waiter = null;
          this.onPendingChange?.(false);
        }
        reject(new Error("Measurement cancelled"));
      };
      const release = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.waiter = { release };
      this.onPendingChange?.(true);
    });
  }
}

export interface MacroMeta {
  /** Base64 source, as delivered in the workbook version's entity snapshots. */
  code: string;
  language: string;
}

export interface MobilePortsDeps {
  scanGate: UserGate;
  analysisGate: UserGate;
  getProtocolCode: (protocolId: string) => Record<string, unknown>[] | null;
  getMacroMeta: (macroId: string) => MacroMeta | null;
  /** Raw scan failure, before the runner flattens it to a message string. */
  onScanError?: (error: unknown) => void;
  onScanSuccess?: (result: unknown) => void;
}

function createCommandExecutor(deps: MobilePortsDeps): CommandExecutorPort {
  return {
    async execute(
      input: CommandRunInput,
      // Progress reaches the UI through the scanner store the wrapped
      // executeCommand already feeds; the runner's onProgress goes unused.
      opts: { signal: AbortSignal; onProgress: (p: CommandProgress) => void },
    ): Promise<unknown> {
      // Never auto-send a device command: forward entry parks here until the
      // user taps Start (tap-initiated runs pre-arm and pass straight through).
      await deps.scanGate.wait(opts.signal);

      // Lazy import: the scanner store pulls the native BT stack in at module
      // load, which only a released gate (a real scan) ever needs.
      const { useScannerCommandExecutorStore } = await import(
        "~/features/connection/stores/use-scanner-command-executor-store"
      );
      const scanner = useScannerCommandExecutorStore.getState();
      const onAbort = () => {
        // cancelCommand sends the device's -1+ switch and rejects the
        // in-flight execute below with "Measurement cancelled".
        void scanner.cancelCommand().catch(() => undefined);
      };
      opts.signal.addEventListener("abort", onAbort, { once: true });
      try {
        const result = await scanner.executeCommand(input.command as string | object);
        if (result === undefined || typeof result !== "object") {
          throw new Error("Invalid result");
        }
        if (!opts.signal.aborted) deps.onScanSuccess?.(result);
        return result;
      } catch (error) {
        if (!opts.signal.aborted) deps.onScanError?.(error);
        throw error;
      } finally {
        opts.signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

function createMacroRunner(deps: MobilePortsDeps): MacroRunnerPort {
  return {
    async run(input: MacroRunInput, opts: { signal: AbortSignal }) {
      // Compute eagerly, park the completion: the analysis screen stays the
      // current step until the user uploads/continues (releases the gate).
      // A macro failure never blocks the flow (mobile parity: the display
      // layer surfaces its own error and upload stays available).
      const resultPromise = (async (): Promise<Record<string, unknown>> => {
        const meta = deps.getMacroMeta(input.macroId);
        if (!meta || input.json === null || typeof input.json !== "object") return {};
        try {
          // Lazy import: process-scan pulls the expo asset system in at module
          // load, which only store consumers that actually run macros need.
          const { applyMacro } = await import(
            "~/features/measurement-flow/utils/process-scan/process-scan"
          );
          const outputs = await applyMacro(input.json, {
            code: meta.code,
            language: meta.language,
          });
          if (outputs.length === 1) return outputs[0];
          return { samples: outputs };
        } catch {
          return {};
        }
      })();
      resultPromise.catch(() => undefined);
      await deps.analysisGate.wait(opts.signal);
      return resultPromise;
    },
  };
}

function createProtocolCodeResolver(deps: MobilePortsDeps): ProtocolCodeResolverPort {
  return {
    resolveProtocolCode(protocolId: string) {
      return Promise.resolve(deps.getProtocolCode(protocolId));
    },
  };
}

export function createMobileRunnerPorts(deps: MobilePortsDeps): WorkbookRunnerPorts {
  return {
    commandExecutor: createCommandExecutor(deps),
    macroRunner: createMacroRunner(deps),
    protocolCodeResolver: createProtocolCodeResolver(deps),
  };
}
