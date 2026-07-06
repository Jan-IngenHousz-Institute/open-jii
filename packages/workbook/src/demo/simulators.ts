import type { CellNamespace } from "../namespace/build-cell-namespace";
import type { ClockPort } from "../ports/clock";
import type {
  CommandExecutorPort,
  CommandProgress,
  CommandRunInput,
} from "../ports/command-executor";
import type { MacroRunnerPort } from "../ports/macro-runner";
import type { OutputStorePort } from "../ports/output-store";
import type { ProtocolCodeResolverPort } from "../ports/protocol-code-resolver";

/** Deterministic injected time for tests and the demo. */
export class FakeClock implements ClockPort {
  private t = 0;
  now(): number {
    return this.t;
  }
  tick(ms: number): void {
    this.t += ms;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type MacroFn = (
  json: unknown,
  ctx: CellNamespace,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

/** In-memory macro runner: the registry plays the role of the host sandbox. */
export function createMacroRunner(registry: Partial<Record<string, MacroFn>>): MacroRunnerPort {
  return {
    async run(input, opts) {
      if (opts.signal.aborted) throw new Error("Macro cancelled");
      const fn = registry[input.macroId];
      if (!fn) throw new Error(`Unknown macro ${input.macroId}`);
      return await fn(input.json, input.ctx);
    },
  };
}

export interface SimulatedExecutor extends CommandExecutorPort {
  calls: CommandRunInput[];
}

/**
 * Immediate command executor: emits a "sent" progress event, then
 * `progressTicks` "receiving" ticks (spaced `tickMs` apart), then resolves
 * with `respond(input, call)`.
 */
export function createSimulatedExecutor(
  options: {
    respond?: (input: CommandRunInput, call: number) => unknown;
    progressTicks?: number;
    tickMs?: number;
  } = {},
): SimulatedExecutor {
  const calls: CommandRunInput[] = [];
  return {
    calls,
    async execute(input, { signal, onProgress }) {
      const call = calls.length;
      calls.push(input);
      const ticks = options.progressTicks ?? 0;
      const tickMs = options.tickMs ?? 0;
      const progress = (phase: CommandProgress["phase"], chunks: number): CommandProgress => ({
        phase,
        chunks,
        bytes: chunks * 64,
        elapsedMs: chunks * tickMs,
        lastEventAt: 0,
      });
      onProgress(progress("sent", 0));
      for (let i = 1; i <= ticks; i++) {
        await sleep(tickMs);
        if (signal.aborted) throw new Error("Command cancelled");
        onProgress(progress("receiving", i));
      }
      if (signal.aborted) throw new Error("Command cancelled");
      return options.respond ? options.respond(input, call) : { echoed: input.command };
    },
  };
}

interface PendingCommand {
  input: CommandRunInput;
  signal: AbortSignal;
  onProgress: (p: CommandProgress) => void;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface ManualExecutor extends CommandExecutorPort {
  pending: PendingCommand[];
  settle(value: unknown): void;
  fail(error: Error): void;
}

/** Executor whose promises the test settles by hand (cancel-race scenarios). */
export function createManualExecutor(): ManualExecutor {
  const pending: PendingCommand[] = [];
  return {
    pending,
    execute(input, { signal, onProgress }) {
      return new Promise((resolve, reject) => {
        pending.push({ input, signal, onProgress, resolve, reject });
      });
    },
    settle(value) {
      const next = pending.shift();
      if (!next) throw new Error("No pending command to settle");
      next.resolve(value);
    },
    fail(error) {
      const next = pending.shift();
      if (!next) throw new Error("No pending command to fail");
      next.reject(error);
    },
  };
}

export function createCodeResolver(
  codeById: Partial<Record<string, Record<string, unknown>[]>>,
): ProtocolCodeResolverPort {
  return {
    resolveProtocolCode(protocolId) {
      return Promise.resolve(codeById[protocolId] ?? null);
    },
  };
}

export interface MemoryOutputStore extends OutputStorePort {
  entries: Map<string, unknown>;
}

export function createMemoryOutputStore(): MemoryOutputStore {
  const entries = new Map<string, unknown>();
  return {
    entries,
    put(key, data) {
      const ref = `mem:${key}`;
      entries.set(ref, data);
      return Promise.resolve(ref);
    },
    get(ref) {
      if (!entries.has(ref)) return Promise.reject(new Error(`Unknown ref ${ref}`));
      return Promise.resolve(entries.get(ref));
    },
  };
}
