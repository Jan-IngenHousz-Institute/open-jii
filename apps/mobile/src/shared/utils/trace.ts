// Wide-event tracing on top of the logger.
//
// Why: "13 log lines per request" can't be debugged. A trace accumulates
// events keyed by a correlation id (e.g. measurement id) and emits ONE
// fat entry on `end()` with timings + every event. Callers across modules
// can attach events to the same trace via `getTrace(id)` — no need to
// thread a trace object through every function signature.
import type { LogFields, Logger } from "./logger";
import { createLogger } from "./logger";

export interface TraceEvent {
  readonly name: string;
  readonly tMs: number;
  readonly fields?: LogFields;
}

export interface TraceResult {
  readonly id: string;
  readonly kind: string;
  readonly status: "ok" | "error";
  readonly totalMs: number;
  readonly events: readonly TraceEvent[];
  readonly fields: LogFields;
}

export interface Trace {
  readonly id: string;
  readonly kind: string;
  event(name: string, fields?: LogFields): void;
  setFields(fields: LogFields): void;
  end(status: "ok" | "error", fields?: LogFields): TraceResult;
}

const registry = new Map<string, TraceImpl>();
const traceLogger = createLogger("trace");

class TraceImpl implements Trace {
  readonly t0: number;
  readonly events: TraceEvent[] = [];
  fields: LogFields;
  ended = false;
  // The finalized result from the first end() call. Returned verbatim on
  // any subsequent end() so a double-end can't fabricate a divergent
  // payload (totalMs: 0, empty events, a different status).
  private result: TraceResult | null = null;

  constructor(
    readonly kind: string,
    readonly id: string,
    base: LogFields | undefined,
    readonly logger: Logger,
  ) {
    this.t0 = Date.now();
    this.fields = { ...(base ?? {}) };
  }

  event(name: string, fields?: LogFields): void {
    if (this.ended) return;
    this.events.push({ name, tMs: Date.now() - this.t0, fields });
  }

  setFields(fields: LogFields): void {
    this.fields = { ...this.fields, ...fields };
  }

  end(status: "ok" | "error", fields?: LogFields): TraceResult {
    // Idempotent: once finalized, return the cached result verbatim so a
    // double-end can't fabricate a divergent payload (totalMs: 0, empty
    // events, a different status). `this.result` doubles as the narrowing
    // guard — truthy only after a real end — so no assertion is needed.
    if (this.result) return this.result;
    this.ended = true;
    registry.delete(this.id);
    const totalMs = Date.now() - this.t0;
    if (fields) this.fields = { ...this.fields, ...fields };

    const result: TraceResult = {
      id: this.id,
      kind: this.kind,
      status,
      totalMs,
      events: this.events,
      fields: this.fields,
    };
    this.result = result;
    const summary = this.events.map((e) =>
      e.fields ? `${e.name}+${e.tMs}(${formatInline(e.fields)})` : `${e.name}+${e.tMs}`,
    );
    const level = status === "ok" ? "info" : "error";
    this.logger[level](this.kind, {
      id: this.id,
      status,
      total_ms: totalMs,
      event_count: this.events.length,
      events: summary,
      ...this.fields,
    });
    return result;
  }
}

function formatInline(fields: LogFields): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    parts.push(`${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  }
  return parts.join(",");
}

export function startTrace(kind: string, id: string, baseFields?: LogFields): Trace {
  // If a trace with this id is already open (e.g. a retry re-enters), keep
  // the existing one so events accumulate end-to-end rather than splitting
  // into two short traces.
  const existing = registry.get(id);
  if (existing) {
    if (baseFields) existing.setFields(baseFields);
    return existing;
  }
  const t = new TraceImpl(kind, id, baseFields, traceLogger);
  registry.set(id, t);
  return t;
}

export function getTrace(id: string): Trace | undefined {
  return registry.get(id);
}

// Test helper — drop any traces left from a previous test.
export function clearTraceRegistry(): void {
  registry.clear();
}
