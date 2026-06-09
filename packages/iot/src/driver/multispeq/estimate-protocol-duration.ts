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
 * - `"@sN"`      → per-iteration step value (intensity, not duration) → unresolved
 */

type Json = unknown;

/** A 2-D table of numeric variable arrays referenced by `@n` / `#l` / `@s`. */
type VArrays = number[][];

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

/**
 * Resolve a numeric reference against the protocol's `v_arrays`.
 * Returns `undefined` when the reference is unknown or step-dependent (`@s`).
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

  // "@sN" → per-iteration step value; affects intensity, not duration.
  return undefined;
}

/** Estimated runtime (ms) of a single `_protocol_set_` block. */
function estimateBlockMs(block: Json, vArrays: VArrays): number {
  if (!isRecord(block)) return 0;

  // Setup blocks (autogain, etc.) carry a small fixed cost rather than a pulse train.
  const hasPulses = Array.isArray(block.pulses) && block.pulses.length > 0;
  if (!hasPulses) {
    return "autogain" in block ? SETUP_BLOCK_MS : 0;
  }

  const pulses = block.pulses as Json[];
  const pulseDistance = Array.isArray(block.pulse_distance) ? (block.pulse_distance as Json[]) : [];

  // Pulse train: Σ pulses[i] × pulse_distance[i] (µs) → ms.
  let pulseTrainUs = 0;
  for (let i = 0; i < pulses.length; i++) {
    const count = asNumber(pulses[i]) ?? 0;
    const distanceUs = asNumber(pulseDistance[i]) ?? 0;
    pulseTrainUs += count * distanceUs;
  }
  const pulseTrainMs = pulseTrainUs / 1000;

  // Pre-illumination duration lives at index 2 of the pre_illumination tuple.
  const preIllumination = Array.isArray(block.pre_illumination)
    ? (block.pre_illumination as Json[])
    : [];
  const preIlluminationMs = resolveNumericRef(preIllumination[2], vArrays) ?? 0;

  const repeats = Math.max(1, resolveNumericRef(block.protocol_repeats, vArrays) ?? 1);
  const averages = Math.max(1, resolveNumericRef(block.protocol_averages, vArrays) ?? 1);

  return (pulseTrainMs + preIlluminationMs) * repeats * averages;
}

/** Estimated runtime (ms) of one top-level protocol-set object. */
function estimateSetMs(set: Json): number {
  if (!isRecord(set)) return 0;

  const vArrays: VArrays = Array.isArray(set.v_arrays) ? (set.v_arrays as VArrays) : [];
  const blocks = Array.isArray(set._protocol_set_) ? (set._protocol_set_ as Json[]) : [];
  const setRepeats = Math.max(1, resolveNumericRef(set.set_repeats, vArrays) ?? 1);

  let perRunMs = 0;
  for (const block of blocks) {
    perRunMs += estimateBlockMs(block, vArrays);
  }
  return perRunMs * setRepeats;
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
