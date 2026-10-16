export interface AmbitSeries {
  name: string;
  unit: string;
  time: number[];
  values: number[];
  estimatedTime: boolean;
}

export type AmbitTraceProblem = "unsupported" | "invalid" | "empty" | "limit";

export interface AmbitTrace {
  label: string;
  series: AmbitSeries[];
  problems: { series?: string; reason: AmbitTraceProblem }[];
}

const MAX_POINTS = 100_000;
const MAX_TOTAL_POINTS = 250_000;
const MAX_TRACES = 32;

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Walk only measurement envelopes, never arbitrary metadata or numeric arrays. */
export function findAmbitTraces(data: unknown): Record<string, unknown>[] {
  const traces: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  function visit(value: unknown, depth: number) {
    if (depth > 8 || value == null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
    } else if (record(value)) {
      if (typeof value.schema === "string" && value.schema.startsWith("ambit.trace/")) {
        traces.push(value);
        return;
      }
      for (const key of ["sample", "sample_raw", "set", "data"]) {
        const child = value[key];
        if (key === "sample_raw" && typeof child === "string") {
          try {
            visit(JSON.parse(child), depth + 1);
          } catch {
            // Invalid stored JSON remains available in the output's JSON tab.
          }
        } else {
          visit(child, depth + 1);
        }
      }
    }
  }
  visit(data, 0);
  return traces;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function decodeAmbitTraces(data: unknown): AmbitTrace[] {
  const candidates = findAmbitTraces(data);
  let remainingPoints = MAX_TOTAL_POINTS;
  const traces = candidates.slice(0, MAX_TRACES).map((candidate, index): AmbitTrace => {
    const identity = [candidate.device, candidate.sensor_id]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
    const trace: AmbitTrace = {
      label: `${index + 1}${identity ? ` · ${identity}` : ""}`,
      series: [],
      problems: [],
    };
    if (candidate.schema !== "ambit.trace/3") {
      trace.problems.push({ reason: "unsupported" });
      return trace;
    }
    if (!record(candidate.series)) {
      trace.problems.push({ reason: "invalid" });
      return trace;
    }
    for (const [name, source] of Object.entries(candidate.series)) {
      const problem = (reason: AmbitTraceProblem) => trace.problems.push({ series: name, reason });
      if (
        !record(source) ||
        typeof source.u !== "string" ||
        !source.u.trim() ||
        !Array.isArray(source.v)
      ) {
        problem("invalid");
        continue;
      }
      if (source.v.length === 0) continue;
      if (source.v.length > MAX_POINTS || source.v.length > remainingPoints) {
        problem("limit");
        continue;
      }
      if (!source.v.every(finite)) {
        problem("invalid");
        continue;
      }
      let time: number[];
      if ("t" in source) {
        if (
          !Array.isArray(source.t) ||
          source.t.length !== source.v.length ||
          !source.t.every(finite)
        ) {
          problem("invalid");
          continue;
        }
        time = source.t;
      } else if (finite(source.t0) && finite(source.dt) && source.dt > 0) {
        const { t0, dt } = source;
        time = source.v.map((_, i) => t0 + i * dt);
      } else {
        problem("invalid");
        continue;
      }
      if (time.some((t, i) => !Number.isFinite(t) || t < 0 || (i > 0 && t < time[i - 1]))) {
        problem("invalid");
        continue;
      }
      remainingPoints -= time.length;
      trace.series.push({
        name,
        unit: source.u,
        time,
        values: source.v,
        estimatedTime: source.t_est === true,
      });
    }
    if (trace.series.length === 0 && trace.problems.length === 0)
      trace.problems.push({ reason: "empty" });
    return trace;
  });
  if (candidates.length > MAX_TRACES) traces[traces.length - 1].problems.push({ reason: "limit" });
  return traces;
}
