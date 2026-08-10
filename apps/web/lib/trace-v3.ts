type TraceLocation = "bare" | "sample" | "sample-set";

export interface TraceSeries {
  name: string;
  unit: string;
  values: number[];
  relativeTimeSeconds: number[];
  estimatedTime: boolean;
  omittedPointCount: number;
}

export interface NormalizedTraceRun {
  trace: Record<string, unknown>;
  series: TraceSeries[];
  invalidSeriesCount: number;
  setIndex?: number;
}

export interface NormalizedTracePayload {
  location: TraceLocation;
  traces: NormalizedTraceRun[];
  /** First-run compatibility helpers for consumers that only need detection. */
  trace: Record<string, unknown>;
  series: TraceSeries[];
}

export interface DirectTraceContext {
  startUtc: number;
  endUtc: number;
  protocolId: string;
  protocolName?: string;
}

interface NormalizedSeriesResult {
  series: TraceSeries | null;
  omittedPointCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toUnknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? (value as unknown[]) : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTraceSchema(value: unknown): boolean {
  return typeof value === "string" && /^[^/]+\.trace\/[^/]+$/.test(value);
}

function looksLikeSeries(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.u === "string" &&
    Array.isArray(value.v) &&
    (Array.isArray(value.t) || "t0" in value || "dt" in value)
  );
}

function normalizeSeries(name: string, value: unknown): NormalizedSeriesResult {
  if (!isRecord(value) || typeof value.u !== "string") {
    return { series: null, omittedPointCount: 0 };
  }
  const rawValues = toUnknownArray(value.v);
  if (!rawValues) return { series: null, omittedPointCount: 0 };

  const values: number[] = [];
  const relativeTimeSeconds: number[] = [];
  let omittedPointCount = 0;

  if ("t" in value) {
    const rawTimes = toUnknownArray(value.t);
    if (!rawTimes) return { series: null, omittedPointCount: 0 };
    const matchedLength = Math.min(rawTimes.length, rawValues.length);
    omittedPointCount = Math.max(rawTimes.length, rawValues.length) - matchedLength;
    for (let index = 0; index < matchedLength; index += 1) {
      const time = rawTimes[index];
      const point = rawValues[index];
      if (!finiteNumber(time) || !finiteNumber(point)) {
        omittedPointCount += 1;
        continue;
      }
      relativeTimeSeconds.push(time);
      values.push(point);
    }
  } else if (finiteNumber(value.t0) && finiteNumber(value.dt) && value.dt > 0) {
    for (let index = 0; index < rawValues.length; index += 1) {
      const point = rawValues[index];
      if (!finiteNumber(point)) {
        omittedPointCount += 1;
        continue;
      }
      relativeTimeSeconds.push(value.t0 + index * value.dt);
      values.push(point);
    }
  } else {
    return { series: null, omittedPointCount: 0 };
  }

  if (values.length === 0) return { series: null, omittedPointCount };
  return {
    series: {
      name,
      unit: value.u,
      values,
      relativeTimeSeconds,
      estimatedTime: value.t_est === true,
      omittedPointCount,
    },
    omittedPointCount,
  };
}

function normalizeTrace(
  trace: Record<string, unknown>,
  setIndex?: number,
): NormalizedTraceRun | null {
  if (!isRecord(trace.series)) return null;

  const entries = Object.entries(trace.series);
  const normalized = entries.map(([name, value]) => normalizeSeries(name, value));
  const series = normalized
    .map((result) => result.series)
    .filter((value): value is TraceSeries => value !== null);
  const selfDescribing = entries.some(([, value]) => looksLikeSeries(value));
  if (!isTraceSchema(trace.schema) && !selfDescribing) return null;

  return {
    trace,
    series,
    invalidSeriesCount: normalized.filter((result) => result.series === null).length,
    ...(setIndex == null ? {} : { setIndex }),
  };
}

function normalizedPayload(
  location: TraceLocation,
  traces: NormalizedTraceRun[],
): NormalizedTracePayload | null {
  if (traces.length === 0) return null;
  const first = traces[0];
  return { location, traces, trace: first.trace, series: first.series };
}

/**
 * Locate and normalize self-describing trace objects. Direct Ambit replies
 * can place status/error records before traces and can contain multiple flat
 * trace records in `sample[0].set`; persisted/MQTT output may be bare or use
 * the Ambyte `sample[0]` envelope. Non-trace set members keep their order and
 * are ignored by the renderer.
 */
export function normalizeTracePayload(data: unknown): NormalizedTracePayload | null {
  if (!isRecord(data)) return null;

  const bare = normalizeTrace(data);
  if (bare) return normalizedPayload("bare", [bare]);

  const firstSample = toUnknownArray(data.sample)?.[0];
  if (!isRecord(firstSample)) return null;

  const set = toUnknownArray(firstSample.set);
  if (set) {
    const traces = set.flatMap((candidate, setIndex) => {
      if (!isRecord(candidate)) return [];
      const normalized = normalizeTrace(candidate, setIndex);
      return normalized ? [normalized] : [];
    });
    const payload = normalizedPayload("sample-set", traces);
    if (payload) return payload;
  }

  const sample = normalizeTrace(firstSample);
  return sample ? normalizedPayload("sample", [sample]) : null;
}

function enrichTrace(
  trace: Record<string, unknown>,
  context: DirectTraceContext,
): Record<string, unknown> {
  const currentTime = isRecord(trace.time) ? trace.time : {};
  const currentProtocol = isRecord(trace.protocol) ? trace.protocol : {};
  return {
    ...trace,
    time: {
      ...currentTime,
      start_utc: context.startUtc,
      end_utc: context.endUtc,
    },
    protocol: {
      ...currentProtocol,
      id: context.protocolId,
      ...(context.protocolName ? { name: context.protocolName } : {}),
    },
  };
}

/** Add browser-owned wall-clock and workbook protocol context without mutation. */
export function enrichDirectTracePayload(data: unknown, context: DirectTraceContext): unknown {
  const normalized = normalizeTracePayload(data);
  if (!normalized) return data;

  if (normalized.location === "bare") return enrichTrace(normalized.trace, context);
  if (!isRecord(data)) return data;

  const currentSample = toUnknownArray(data.sample);
  if (!currentSample) return data;
  const sample = [...currentSample];
  const firstSample = sample[0];
  if (!isRecord(firstSample)) return data;

  if (normalized.location === "sample") {
    sample[0] = enrichTrace(normalized.trace, context);
    return { ...data, sample };
  }

  const currentSet = toUnknownArray(firstSample.set);
  if (!currentSet) return data;
  const set = [...currentSet];
  for (const trace of normalized.traces) {
    if (trace.setIndex != null) set[trace.setIndex] = enrichTrace(trace.trace, context);
  }
  sample[0] = { ...firstSample, set };
  return { ...data, sample };
}
