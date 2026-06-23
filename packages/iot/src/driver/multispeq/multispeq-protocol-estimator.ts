/**
 * MultispeQ protocol duration estimation.
 *
 * The MultispeQ device does not report how long a protocol will take to run,
 * yet long protocols (e.g. a light response curve) can legitimately run for
 * minutes. A fixed response timeout therefore either aborts valid long
 * measurements (too short) or hangs the UI on a dead device (too long).
 *
 * These helpers derive a conservative duration estimate from the protocol JSON
 * so callers can size a response timeout to the work actually requested, with
 * head-room, and a hard ceiling. See OJD-1565.
 *
 * The estimate is intentionally a rough upper-ish bound — it sizes a timeout,
 * not a measurement. When a value cannot be resolved it is treated as 0 and the
 * safety factor / floor compensate.
 *
 * ## Protocol shape (only the timing-relevant fields)
 *
 * ```jsonc
 * [{
 *   "_protocol_set_": [
 *     {
 *       "pulses":         [100, 200, 100],   // pulse counts per phase
 *       "pulse_distance": [1500, 1500, 1500],// µs between pulses, per phase
 *       "pre_illumination": [2, "@s0", "@n1:0"], // [light, intensity, duration_ms]
 *       "protocol_repeats": 3,
 *       "protocol_averages": 1
 *     }
 *   ],
 *   "set_repeats": "#l0",                     // repeat whole set N times
 *   "v_arrays": [[0,50,100,200,400,800,0], [5000, 5000]]
 * }]
 * ```
 *
 * ## Reference syntax resolved here
 * - `123`        → literal number
 * - `"#lN"`      → length of `v_arrays[N]`
 * - `"@nN:I"`    → `v_arrays[N][I]`
 * - `"@sN"`      → `v_arrays[N][occurrence]` (per set-repeat step value)
 *
 * This module is the single origin of the MultispeQ protocol timing model: a
 * phase with N pulses, K detector channels and D µs `pulse_distance` lasts
 * N*K*D µs (one pulse per channel), plus `pre_illumination` and
 * `protocols_delay` waits. apps/web's `pipeline.ts` reuses `resolveProtocolVariables`
 * from here so the estimate and the rendered chart resolve variables identically.
 */

type Json = unknown;

/** A 2-D table of variable arrays referenced by `@n` / `#l` / `@s` (cells may be non-numeric). */
export type VArrays = unknown[][];

/** Fixed overhead (ms) attributed to a setup block (e.g. `autogain`). */
const SETUP_BLOCK_MS = 3_000;

/** Options controlling how an estimate is turned into a timeout budget. */
export interface ScanTimeoutOptions {
  /** Multiplier applied to the raw estimate (default 2 — 100% head-room). */
  safetyFactor?: number;
  /** Flat head-room added on top, in ms (default 10_000). */
  graceMs?: number;
  /** Lower bound — protocols never get less than this, in ms (default 60_000). */
  minMs?: number;
  /** Upper bound — hard ceiling so a dead device cannot hang forever (default 600_000). */
  maxMs?: number;
}

export const SCAN_TIMEOUT_DEFAULTS: Required<ScanTimeoutOptions> = {
  safetyFactor: 2,
  graceMs: 10_000,
  minMs: 60_000,
  maxMs: 600_000,
};

function isRecord(value: Json): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: Json): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isTruthy(value: Json): boolean {
  return value === true || value === 1;
}

/** Phase lookup with `getSafe` fallback: a short array reuses its last entry. */
function getSafe(lst: Json[], idx: number, fallback: Json): Json {
  if (lst.length === 0) return fallback;
  return idx < lst.length ? lst[idx] : lst[lst.length - 1];
}

/**
 * Resolve an occurrence-independent numeric reference against `v_arrays`:
 * literal numbers, `#lN` (array length) and `@nN:I` (a fixed cell). Returns
 * `undefined` for `@sN` step references — those depend on the set-repeat
 * occurrence and are resolved through {@link resolveProtocolVariables}.
 */
export function resolveNumericRef(ref: Json, vArrays: VArrays): number | undefined {
  const literal = asNumber(ref);
  if (literal !== undefined) return literal;
  if (typeof ref !== "string") return undefined;

  // "#lN" → length of v_arrays[N]
  const lengthMatch = /^#l(\d+)$/.exec(ref);
  if (lengthMatch) {
    return vArrays[Number(lengthMatch[1])]?.length;
  }

  // "@nN:I" → v_arrays[N][I]
  const indexMatch = /^@n(\d+):(\d+)$/.exec(ref);
  if (indexMatch) {
    return asNumber(vArrays[Number(indexMatch[1])]?.[Number(indexMatch[2])]);
  }

  return undefined;
}

/**
 * Build the `@nN:I` / `@sN` numeric lookup table for one set-repeat occurrence —
 * the single origin of MultispeQ variable resolution, shared by this estimator
 * and apps/web's `pipeline.ts` (its `resolveVariables` delegates here).
 *
 * Every numeric cell of `v_arrays[N]` is exposed as `@nN:I`. `@sN` is the
 * device's per-occurrence step value: `v_arrays[N][occurrence]`, clamped to the
 * last numeric entry when the occurrence runs past the array. A non-numeric slot
 * in range (e.g. the `"p_light"` runtime placeholder) leaves `@sN` unset so the
 * caller can fall back to the device's measured value.
 */
export function resolveProtocolVariables(vArrays: VArrays, occurrence = 0): Record<string, number> {
  const lookup: Record<string, number> = {};
  vArrays.forEach((arr, i) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    arr.forEach((val, j) => {
      const n = asNumber(val);
      if (n !== undefined) lookup[`@n${i}:${j}`] = Math.trunc(n);
    });
    let chosen: number | undefined;
    if (occurrence < arr.length) {
      const indexed = asNumber(arr[occurrence]);
      if (indexed !== undefined) chosen = Math.trunc(indexed);
    } else {
      for (const val of arr) {
        const n = asNumber(val);
        if (n !== undefined) chosen = Math.trunc(n);
      }
    }
    if (chosen !== undefined) lookup[`@s${i}`] = chosen;
  });
  return lookup;
}

/** Resolve a reference for an occurrence: literal / `#lN` / `@nN:I`, then `@sN`. */
function resolveField(
  ref: Json,
  vArrays: VArrays,
  vars: Record<string, number>,
): number | undefined {
  const base = resolveNumericRef(ref, vArrays);
  if (base !== undefined) return base;
  if (typeof ref === "string" && ref in vars) return vars[ref];
  return undefined;
}

/** Detector channels in a phase — the device fires one pulse per channel. */
function channelCount(detectorsEntry: Json): number {
  return Array.isArray(detectorsEntry) ? Math.max(1, detectorsEntry.length) : 1;
}

/** Estimated runtime (ms) of a single `_protocol_set_` block for one occurrence. */
function estimateBlockMs(block: Json, vArrays: VArrays, vars: Record<string, number>): number {
  if (!isRecord(block)) return 0;

  // Setup blocks (autogain, etc.) carry a small fixed cost rather than a pulse train.
  const hasPulses = Array.isArray(block.pulses) && block.pulses.length > 0;
  if (!hasPulses) {
    return "autogain" in block ? SETUP_BLOCK_MS : 0;
  }

  const pulses = block.pulses as Json[];
  const pulseDistance = Array.isArray(block.pulse_distance) ? (block.pulse_distance as Json[]) : [];
  const detectors = Array.isArray(block.detectors) ? (block.detectors as Json[]) : [];

  // Pulse train: Σ pulses[i] × channels[i] × pulse_distance[i] (µs) → ms. Each
  // detector channel fires as its own pulse spaced by pulse_distance, so a phase
  // with K detectors lasts K× a single-detector phase — the same N×K×D model
  // apps/web's pipeline lays the chart out on. Entries may be refs (e.g. "@s8",
  // "@n0:1"); resolve them so a referenced count/distance isn't read as 0.
  let pulseTrainUs = 0;
  for (let i = 0; i < pulses.length; i++) {
    const count = resolveField(pulses[i], vArrays, vars) ?? 0;
    const distanceUs = resolveField(getSafe(pulseDistance, i, 0), vArrays, vars) ?? 0;
    const channels = channelCount(getSafe(detectors, i, [0]));
    pulseTrainUs += count * channels * distanceUs;
  }
  const pulseTrainMs = pulseTrainUs / 1000;

  // Pre-illumination duration (ms) lives at index 2 of the pre_illumination tuple.
  const preIllumination = Array.isArray(block.pre_illumination)
    ? (block.pre_illumination as Json[])
    : [];
  const preIlluminationMs = resolveField(preIllumination[2], vArrays, vars) ?? 0;

  const repeats = Math.max(1, resolveField(block.protocol_repeats, vArrays, vars) ?? 1);
  const averages = Math.max(1, resolveField(block.protocol_averages, vArrays, vars) ?? 1);
  // protocols_delay is a wall-clock wait (seconds) the device holds before each
  // block run; the chart pipeline counts it too. Scales with repeats, not averages.
  const delayMs = (resolveField(block.protocols_delay, vArrays, vars) ?? 0) * 1_000;

  return (pulseTrainMs + preIlluminationMs) * repeats * averages + delayMs * repeats;
}

/** Estimated runtime (ms) of one top-level protocol-set object. */
function estimateSetMs(set: Json): number {
  if (!isRecord(set)) return 0;

  const vArrays: VArrays = Array.isArray(set.v_arrays) ? (set.v_arrays as VArrays) : [];
  const blocks = Array.isArray(set._protocol_set_) ? (set._protocol_set_ as Json[]) : [];
  const setRepeats = Math.max(1, resolveNumericRef(set.set_repeats, vArrays) ?? 1);

  // Walk each set-repeat occurrence so `@sN` step values (pulse counts/distances
  // that change per repeat) are summed for real rather than approximated.
  let total = 0;
  for (let occurrence = 0; occurrence < setRepeats; occurrence++) {
    const vars = resolveProtocolVariables(vArrays, occurrence);
    for (const block of blocks) {
      // `do_once` blocks (e.g. autogain calibration) run a single time for the
      // whole set, not once per repeat.
      if (occurrence > 0 && isRecord(block) && isTruthy(block.do_once)) continue;
      total += estimateBlockMs(block, vArrays, vars);
    }
  }
  return total;
}

/**
 * Best-effort estimate of how long a MultispeQ protocol will take to run, in ms.
 * Accepts the protocol as the canonical array form or a single set object.
 * Returns 0 for anything it cannot interpret (callers should apply a floor).
 */
export function estimateProtocolDurationMs(protocol: Json): number {
  const sets = Array.isArray(protocol) ? protocol : [protocol];
  let total = 0;
  for (const set of sets) {
    total += estimateSetMs(set);
  }
  return total;
}

/**
 * Turn a protocol into a response-timeout budget (ms): estimate × safety + grace,
 * clamped to [minMs, maxMs].
 */
export function computeScanTimeoutMs(protocol: Json, options: ScanTimeoutOptions = {}): number {
  const { safetyFactor, graceMs, minMs, maxMs } = { ...SCAN_TIMEOUT_DEFAULTS, ...options };
  const estimate = estimateProtocolDurationMs(protocol);
  const budget = estimate * safetyFactor + graceMs;
  return Math.min(maxMs, Math.max(minMs, Math.round(budget)));
}

/**
 * Pick a response timeout (ms) for a command, shared by every MultispeQ
 * transport (web driver, mobile executor) so the policy lives in one place.
 *
 * Plain string console commands (battery, hello, …) resolve quickly so they
 * keep the base timeout. Measurement protocols are sent as JSON (object/array)
 * and can legitimately run for minutes — e.g. a light response curve — so the
 * timeout is sized to the protocol's estimated runtime plus head-room, never
 * below `baseTimeoutMs`. See OJD-1565.
 */
export function resolveCommandTimeoutMs(command: Json, baseTimeoutMs: number): number {
  if (typeof command === "string") {
    return baseTimeoutMs;
  }
  return computeScanTimeoutMs(command, { minMs: baseTimeoutMs });
}
