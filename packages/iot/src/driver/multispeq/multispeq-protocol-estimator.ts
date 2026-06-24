/**
 * MultispeQ protocol duration estimation. Derives a rough upper-ish runtime from
 * the protocol JSON so callers can size a response timeout (and show an ETA)
 * without the device reporting one. See OJD-1565.
 *
 * Timing model (shared with apps/web's pipeline.ts): a phase with N pulses, K
 * detector channels and D µs pulse_distance lasts N*K*D µs, plus pre_illumination
 * and protocols_delay waits. Refs: `#lN` (length), `@nN:I` (cell), `@sN`
 * (per-occurrence step value). Unresolvable values are treated as 0.
 */

type Json = unknown;

export type VArrays = unknown[][];

const SETUP_BLOCK_MS = 3_000;

export interface ScanTimeoutOptions {
  /** Multiplier applied to the raw estimate (default 2, 100% head-room). */
  safetyFactor?: number;
  /** Flat head-room added on top, in ms (default 10_000). */
  graceMs?: number;
  /** Lower bound, in ms (default 60_000). */
  minMs?: number;
  /** Upper bound so a dead device cannot hang forever, in ms (default 600_000). */
  maxMs?: number;
}

export const SCAN_TIMEOUT_DEFAULTS: Required<ScanTimeoutOptions> = {
  safetyFactor: 2,
  graceMs: 10_000,
  minMs: 60_000,
  maxMs: 600_000,
};

/**
 * Floor (ms) for a measurement protocol's response timeout. The pulse estimate
 * only covers compute time, but a protocol can pause on a physical open/close
 * gate (`par_led_start_on_*`) where the device sits silent for as long as the
 * user takes to open/close the clamp. 2 min covers a typical hand-measured
 * DIRK/PAM workflow while still letting a truly dead device fail well before
 * the 10 min maxMs. See OJD-1643.
 */
export const MEASUREMENT_TIMEOUT_FLOOR_MS = 120_000;

function isRecord(value: Json): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: Json): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isTruthy(value: Json): boolean {
  return value === true || value === 1;
}

function getSafe(lst: Json[], idx: number, fallback: Json): Json {
  if (lst.length === 0) return fallback;
  return idx < lst.length ? lst[idx] : lst[lst.length - 1];
}

/** Resolve a literal / `#lN` / `@nN:I` ref; `@sN` is occurrence-dependent, see resolveProtocolVariables. */
export function resolveNumericRef(ref: Json, vArrays: VArrays): number | undefined {
  const literal = asNumber(ref);
  if (literal !== undefined) return literal;
  if (typeof ref !== "string") return undefined;

  const lengthMatch = /^#l(\d+)$/.exec(ref);
  if (lengthMatch) return vArrays[Number(lengthMatch[1])]?.length;

  const indexMatch = /^@n(\d+):(\d+)$/.exec(ref);
  if (indexMatch) return asNumber(vArrays[Number(indexMatch[1])]?.[Number(indexMatch[2])]);

  return undefined;
}

/**
 * `@nN:I` / `@sN` lookup table for one set-repeat occurrence: the single origin
 * of MultispeQ variable resolution, shared with apps/web's pipeline.ts. `@sN` is
 * `v_arrays[N][occurrence]`, clamped to the last numeric when out of range and
 * left unset for an in-range non-numeric placeholder (e.g. "p_light").
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

function channelCount(detectorsEntry: Json): number {
  return Array.isArray(detectorsEntry) ? Math.max(1, detectorsEntry.length) : 1;
}

function estimateBlockMs(block: Json, vArrays: VArrays, vars: Record<string, number>): number {
  if (!isRecord(block)) return 0;

  // Setup blocks (autogain, etc.) carry a fixed cost rather than a pulse train.
  const hasPulses = Array.isArray(block.pulses) && block.pulses.length > 0;
  if (!hasPulses) return "autogain" in block ? SETUP_BLOCK_MS : 0;

  const pulses = block.pulses as Json[];
  const pulseDistance = Array.isArray(block.pulse_distance) ? (block.pulse_distance as Json[]) : [];
  const detectors = Array.isArray(block.detectors) ? (block.detectors as Json[]) : [];

  let pulseTrainUs = 0;
  for (let i = 0; i < pulses.length; i++) {
    const count = resolveField(pulses[i], vArrays, vars) ?? 0;
    const distanceUs = resolveField(getSafe(pulseDistance, i, 0), vArrays, vars) ?? 0;
    pulseTrainUs += count * channelCount(getSafe(detectors, i, [0])) * distanceUs;
  }
  const pulseTrainMs = pulseTrainUs / 1000;

  const preIllumination = Array.isArray(block.pre_illumination)
    ? (block.pre_illumination as Json[])
    : [];
  const preIlluminationMs = resolveField(preIllumination[2], vArrays, vars) ?? 0;

  const repeats = Math.max(1, resolveField(block.protocol_repeats, vArrays, vars) ?? 1);
  const averages = Math.max(1, resolveField(block.protocol_averages, vArrays, vars) ?? 1);
  const delayMs = (resolveField(block.protocols_delay, vArrays, vars) ?? 0) * 1_000;

  return (pulseTrainMs + preIlluminationMs) * repeats * averages + delayMs * repeats;
}

function estimateSetMs(set: Json): number {
  if (!isRecord(set)) return 0;

  const vArrays: VArrays = Array.isArray(set.v_arrays) ? (set.v_arrays as VArrays) : [];
  const blocks = Array.isArray(set._protocol_set_) ? (set._protocol_set_ as Json[]) : [];
  const setRepeats = Math.max(1, resolveNumericRef(set.set_repeats, vArrays) ?? 1);

  let total = 0;
  for (let occurrence = 0; occurrence < setRepeats; occurrence++) {
    const vars = resolveProtocolVariables(vArrays, occurrence);
    for (const block of blocks) {
      // do_once blocks (e.g. autogain) run a single time for the whole set.
      if (occurrence > 0 && isRecord(block) && isTruthy(block.do_once)) continue;
      total += estimateBlockMs(block, vArrays, vars);
    }
  }
  return total;
}

/** Estimated runtime (ms) of a protocol (array form or a single set object); 0 if uninterpretable. */
export function estimateProtocolDurationMs(protocol: Json): number {
  const sets = Array.isArray(protocol) ? protocol : [protocol];
  let total = 0;
  for (const set of sets) {
    total += estimateSetMs(set);
  }
  return total;
}

/** Timeout budget (ms): estimate × safety + grace, clamped to [minMs, maxMs]. */
export function computeScanTimeoutMs(protocol: Json, options: ScanTimeoutOptions = {}): number {
  const { safetyFactor, graceMs, minMs, maxMs } = { ...SCAN_TIMEOUT_DEFAULTS, ...options };
  const estimate = estimateProtocolDurationMs(protocol);
  const budget = estimate * safetyFactor + graceMs;
  return Math.min(maxMs, Math.max(minMs, Math.round(budget)));
}

/**
 * Response timeout (ms) for a command. String console commands keep the base
 * timeout; JSON measurement protocols are sized to their estimated runtime but
 * floored at MEASUREMENT_TIMEOUT_FLOOR_MS, so a protocol that pauses on a
 * physical open/close gate (device silent while the user acts) is not cut off
 * by the pulse-only estimate. Long protocols still grow past the floor.
 */
export function resolveCommandTimeoutMs(command: Json, baseTimeoutMs: number): number {
  if (typeof command === "string") return baseTimeoutMs;
  return computeScanTimeoutMs(command, { minMs: MEASUREMENT_TIMEOUT_FLOOR_MS });
}

const INTERACTION_GATE_KEYS = ["par_led_start_on_open", "par_led_start_on_close"] as const;

function hasInteractionGate(block: Json): boolean {
  return isRecord(block) && INTERACTION_GATE_KEYS.some((key) => key in block);
}

/**
 * True when the protocol pauses for a physical open/close of the leaf clamp
 * (`par_led_start_on_open` / `par_led_start_on_close`). While gated the device
 * stays silent and the run is human-paced, so callers should prompt the user to
 * open/close the clamp. See OJD-1643.
 */
export function protocolRequiresInteraction(protocol: Json): boolean {
  const sets = Array.isArray(protocol) ? protocol : [protocol];
  return sets.some((set) => {
    if (!isRecord(set)) return false;
    if (hasInteractionGate(set)) return true;
    const blocks = Array.isArray(set._protocol_set_) ? (set._protocol_set_ as Json[]) : [];
    return blocks.some(hasInteractionGate);
  });
}
