// Namespaced structured logger.
//
// Why: scattered `console.log("[ns] msg", { ... })` calls are noisy and
// can't be correlated. This util gives every call a namespace, a level,
// and structured fields — and routes through a sink array so test code,
// PostHog, or a future remote drain can subscribe without touching call
// sites.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface LogEntry {
  readonly ts: number;
  readonly level: LogLevel;
  readonly ns: string;
  readonly msg: string;
  readonly fields: LogFields;
}

export interface LogSink {
  write(entry: LogEntry): void;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(extraFields: LogFields): Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const sinks = new Set<LogSink>();
let minLevel: LogLevel = "debug";

export function setMinLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function addLogSink(sink: LogSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

export function clearLogSinks(): void {
  sinks.clear();
}

export function emit(entry: LogEntry): void {
  if (LEVEL_RANK[entry.level] < LEVEL_RANK[minLevel]) return;
  sinks.forEach((sink) => {
    try {
      sink.write(entry);
    } catch {
      // A bad sink must never break the caller.
    }
  });
}

export function createLogger(ns: string, baseFields: LogFields = {}): Logger {
  const make = (level: LogLevel) => (msg: string, fields?: LogFields) => {
    emit({
      ts: Date.now(),
      level,
      ns,
      msg,
      fields: fields ? { ...baseFields, ...fields } : baseFields,
    });
  };
  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    child(extraFields) {
      return createLogger(ns, { ...baseFields, ...extraFields });
    },
  };
}

// Default console sink. Pretty single-line in dev, JSON elsewhere.
// Kept simple: one line per entry; matches the loggingsucks "wide event"
// idea when paired with the trace helper (which collapses many events
// into one final entry).
const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : true;

function formatFields(fields: LogFields): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    parts.push(`${k}=${formatValue(v)}`);
  }
  return parts.join(" ");
}

function formatValue(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "string") return v.includes(" ") ? JSON.stringify(v) : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Error) return JSON.stringify({ message: v.message, name: v.name });
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function timestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

export const consoleSink: LogSink = {
  write(entry) {
    if (isDev) {
      const head = `${timestamp(entry.ts)} ${LEVEL_LABEL[entry.level]} [${entry.ns}] ${entry.msg}`;
      const tail = formatFields(entry.fields);
      const line = tail ? `${head} ${tail}` : head;
      // Route by level so dev tools group/filter correctly.
      if (entry.level === "error") console.error(line);
      else if (entry.level === "warn") console.warn(line);
      else console.log(line);
      return;
    }
    const payload = {
      ts: entry.ts,
      level: entry.level,
      ns: entry.ns,
      msg: entry.msg,
      ...entry.fields,
    };
    if (entry.level === "error") console.error(JSON.stringify(payload));
    else if (entry.level === "warn") console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  },
};

addLogSink(consoleSink);
