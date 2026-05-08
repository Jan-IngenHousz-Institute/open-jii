/**
 * Port of jii-data-platform's protocol_pipeline/pipeline.py.
 * Decodes a PhotosynQ/MultispeQ measurement (sample_raw + protocol JSON) into
 * input (LED) and output (detector) timeseries records.
 *
 * Timing model: for a phase with N pulses, D µs pulse_distance, and K active
 * detectors, each pulse emits one timestamp; phase duration is N*D, not N*K*D.
 */

export const LED_NAMES: Record<number, string> = {
  1: "530 nm (green, body)",
  2: "655 nm (red, body)",
  3: "590 nm (amber, body)",
  4: "448 nm (blue, body)",
  5: "950 nm (NIR, body)",
  6: "950 nm (NIR, clamp)",
  7: "655 nm (red, clamp)",
  8: "850 nm (NIR, clamp)",
  9: "730 nm (far-red, clamp)",
  10: "820 nm (NIR, clamp)",
};

// Approximate visual colours for the body LEDs; mirrors the notebook palette.
export const LED_COLORS: Record<number, string> = {
  1: "#1b5e20",
  2: "#c62828",
  3: "#e65100",
  4: "#1565c0",
  5: "#424242",
  6: "#616161",
  7: "#c62828",
  8: "#0d47a1",
  9: "#6a1b9a",
  10: "#4e342e",
};

export interface ProtocolSetEntry {
  label?: string;
  pulses?: unknown[];
  pulse_distance?: unknown[];
  detectors?: unknown[];
  pulsed_lights?: unknown[];
  pulsed_lights_brightness?: unknown[];
  nonpulsed_lights?: unknown[];
  nonpulsed_lights_brightness?: unknown[];
  pre_illumination?: unknown[];
  protocols_delay?: number;
  e_time?: unknown;
}

export interface ProtocolJson {
  _protocol_set_?: ProtocolSetEntry[];
  v_arrays?: unknown[][];
}

export interface SubProtocolRecord {
  measurement_id: string | null;
  project_id: string | null;
  protocol_id: number | null;
  sub_protocol_index: number;
  label: string;
  data_raw: number[];
  data_raw_len: number;
  time: number | null;
  time_offset: number | null;
  pi_json: string | null;
  metadata_json: string | null;
}

export interface InputRecord {
  sub_protocol?: string;
  phase_index: number;
  t_start_us: number;
  t_end_us: number;
  led: number | null;
  brightness: number | null;
  light_type: "pre_illumination" | "actinic" | "measuring";
}

export interface OutputRecord {
  sub_protocol?: string;
  phase_index: number;
  pulse_index: number;
  detector: number;
  light: number;
  timestamp_us: number;
  value: number;
}

export interface MeasurementInput {
  measurement_id?: string | null;
  project_id?: string | null;
  sample_raw?: string | unknown[] | null;
}

interface ResolvedEntry {
  pulses: number[];
  pulse_distance: number[];
  detectors: (number | null)[][];
  pulsed_lights: (number | null)[][];
  pulsed_lights_brightness: (number | null)[][];
  nonpulsed_lights: (number | null)[][];
  nonpulsed_lights_brightness: (number | null)[][];
  pre_illumination: unknown[];
}

function getSafe<T>(lst: T[] | undefined | null, idx: number, fallback: T): T {
  if (!lst || lst.length === 0) return fallback;
  if (idx < lst.length) return lst[idx];
  return lst[lst.length - 1];
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Build the `@nX:Y` / `@sX` lookup table for a sub-protocol occurrence.
 *
 * `@nX:Y` is constant across occurrences (a fixed cell of `v_arrays`).
 *
 * `@sX` is the "set parameter" used in scalar contexts (e.g. `pulses`).
 * When a protocol declares `set_repeats: N`, the device picks a different value
 * per repeat by indexing `v_arrays[X]` with the occurrence number. We mirror
 * that — `f_transient` with `pulses: ["@s8"]` and `v_arrays[8] = [20, 100]`
 * runs 20 pulses on repeat 0 and 100 on repeat 1. If the indexed value is
 * non-numeric (e.g. the placeholder `"p_light"`), fall back to the last
 * numeric in the array (matches observed `["p_light", 2500] → 2500`).
 */
export function resolveVariables(
  protocolJson: ProtocolJson,
  occurrence = 0,
): Record<string, number> {
  const lookup: Record<string, number> = {};
  const arrs = protocolJson.v_arrays ?? [];
  arrs.forEach((arr, i) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((val, j) => {
      if (isFiniteNumber(val)) lookup[`@n${i}:${j}`] = Math.trunc(val);
    });
    let lastNumeric: number | null = null;
    for (const val of arr) if (isFiniteNumber(val)) lastNumeric = Math.trunc(val);
    const indexed = arr[Math.min(occurrence, arr.length - 1)];
    const chosen = isFiniteNumber(indexed) ? Math.trunc(indexed) : lastNumeric;
    if (chosen != null) lookup[`@s${i}`] = chosen;
  });
  return lookup;
}

function resolveInt(val: unknown, variables: Record<string, number>): number | null {
  if (isFiniteNumber(val)) return Math.trunc(val);
  if (typeof val === "string" && val in variables) return variables[val] ?? null;
  return null;
}

function resolveList(lst: unknown[], variables: Record<string, number>): (number | null)[] {
  return lst.map((v) => resolveInt(v, variables));
}

function resolveNested(lst: unknown[], variables: Record<string, number>): (number | null)[][] {
  return lst.map((item) => {
    if (Array.isArray(item)) return item.map((v) => resolveInt(v, variables));
    const r = resolveInt(item, variables);
    return [r ?? 0];
  });
}

export function resolveProtocolSetEntry(
  entry: ProtocolSetEntry,
  variables: Record<string, number> = {},
): ResolvedEntry {
  return {
    pulses: resolveList(entry.pulses ?? [], variables).map((v) => v ?? 0),
    pulse_distance: resolveList(entry.pulse_distance ?? [], variables).map((v) => v ?? 0),
    detectors: resolveNested(entry.detectors ?? [], variables),
    pulsed_lights: resolveNested(entry.pulsed_lights ?? [], variables),
    pulsed_lights_brightness: resolveNested(entry.pulsed_lights_brightness ?? [], variables),
    nonpulsed_lights: resolveNested(entry.nonpulsed_lights ?? [], variables),
    nonpulsed_lights_brightness: resolveNested(entry.nonpulsed_lights_brightness ?? [], variables),
    pre_illumination: entry.pre_illumination ?? [],
  };
}

export function predictDataRawLength(
  entry: ProtocolSetEntry,
  variables: Record<string, number> = {},
): number {
  const r = resolveProtocolSetEntry(entry, variables);
  let total = 0;
  for (let i = 0; i < r.pulses.length; i++) {
    const dets = getSafe(r.detectors, i, []);
    const nActive = dets.filter((d) => d != null && d !== 0).length;
    total += (r.pulses[i] ?? 0) * nActive;
  }
  return total;
}

export function outputRecords(
  dataRaw: number[],
  entry: ProtocolSetEntry,
  variables: Record<string, number> = {},
): OutputRecord[] {
  const r = resolveProtocolSetEntry(entry, variables);
  if (r.pulses.length === 0 || dataRaw.length === 0) return [];

  const out: OutputRecord[] = [];
  let offset = 0;
  let tUs = 0;

  for (let phase = 0; phase < r.pulses.length; phase++) {
    const dets = getSafe(r.detectors, phase, [0]);
    const lights = getSafe(r.pulsed_lights, phase, [0]);
    const pDist = getSafe(r.pulse_distance, phase, 0);
    const nChannels = Math.max(1, dets.length);
    const nPulses = r.pulses[phase] ?? 0;
    // Each (detector, light) entry in dets/lights is a SEPARATE pulse — the
    // device fires them sequentially across pulses, not simultaneously within
    // a single pulse. So a phase declared as N pulses with K channels emits
    // N × K pulses total, advancing time by pulse_distance per emission.
    const total = nPulses * nChannels;

    for (let pulseIdx = 0; pulseIdx < total; pulseIdx++) {
      tUs += pDist;
      const ch = pulseIdx % nChannels;
      const detId = dets[ch] ?? 0;
      const lightId = (ch < lights.length ? lights[ch] : 0) ?? 0;
      if (detId !== 0 && offset < dataRaw.length) {
        out.push({
          phase_index: phase,
          pulse_index: pulseIdx,
          detector: detId,
          light: lightId,
          timestamp_us: tUs,
          value: dataRaw[offset],
        });
        offset += 1;
      }
    }
  }
  return out;
}

function resolveArrayRef(ref: unknown, vArrays: unknown[][]): unknown[] {
  if (typeof ref === "string" && ref.startsWith("@s")) {
    const idx = Number.parseInt(ref.slice(2), 10);
    if (Number.isFinite(idx) && idx >= 0 && idx < vArrays.length) {
      const arr = vArrays[idx];
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  }
  if (Array.isArray(ref)) return ref;
  return [ref];
}

function resolvePreIllumination(
  preIllumination: unknown[],
  protocolJson: ProtocolJson,
): { led: number; brightness: number | null; duration_ms: number }[] {
  if (preIllumination.length < 3) return [];
  const ledId = preIllumination[0];
  if (typeof ledId !== "number") return [];
  const vArrays = protocolJson.v_arrays ?? [];
  const brightnesses = resolveArrayRef(preIllumination[1], vArrays);
  const durations = resolveArrayRef(preIllumination[2], vArrays);
  const steps: { led: number; brightness: number | null; duration_ms: number }[] = [];
  const len = Math.max(brightnesses.length, durations.length);
  for (let i = 0; i < len; i++) {
    const b =
      i < brightnesses.length
        ? brightnesses[i]
        : brightnesses.length > 0
          ? brightnesses[brightnesses.length - 1]
          : 0;
    const d =
      i < durations.length
        ? durations[i]
        : durations.length > 0
          ? durations[durations.length - 1]
          : 0;
    steps.push({
      led: ledId,
      brightness: isFiniteNumber(b) ? Math.round(b) : null,
      duration_ms: isFiniteNumber(d) ? Math.trunc(d) : 0,
    });
  }
  return steps;
}

export function inputRecords(
  entry: ProtocolSetEntry,
  variables: Record<string, number> = {},
  protocolJson: ProtocolJson | null = null,
  pi: unknown[] | null = null,
): InputRecord[] {
  const r = resolveProtocolSetEntry(entry, variables);
  const records: InputRecord[] = [];
  let tUs = 0;

  if (pi && pi.length >= 3) {
    const ledId = pi[0];
    const brightnessRaw = pi[1];
    const durMs = pi[2];
    const brightness = isFiniteNumber(brightnessRaw) ? Math.round(brightnessRaw) : null;
    const durUs = isFiniteNumber(durMs) ? Math.trunc(durMs * 1000) : 0;
    if (typeof ledId === "number" && ledId !== 0 && durUs > 0) {
      records.push({
        phase_index: -1,
        t_start_us: tUs,
        t_end_us: tUs + durUs,
        led: Math.trunc(ledId),
        brightness,
        light_type: "pre_illumination",
      });
    }
    tUs += durUs;
  } else if (entry.pre_illumination && protocolJson) {
    for (const step of resolvePreIllumination(entry.pre_illumination, protocolJson)) {
      const durUs = step.duration_ms > 0 ? step.duration_ms * 1000 : 0;
      if (step.led !== 0 && durUs > 0) {
        records.push({
          phase_index: -1,
          t_start_us: tUs,
          t_end_us: tUs + durUs,
          led: step.led,
          brightness: step.brightness,
          light_type: "pre_illumination",
        });
      }
      tUs += durUs;
    }
  }

  for (let phase = 0; phase < r.pulses.length; phase++) {
    const pDist = getSafe(r.pulse_distance, phase, 0);
    const dets = getSafe(r.detectors, phase, [0]);
    const nChannels = Math.max(1, dets.length);
    // Phase duration mirrors `outputRecords`: the device fires N × K sequential
    // pulses for N declared pulses and K detector/light channels per pulse.
    const phaseDur = (r.pulses[phase] ?? 0) * nChannels * pDist;

    const npLeds = getSafe(r.nonpulsed_lights, phase, []);
    const npBright = getSafe(r.nonpulsed_lights_brightness, phase, []);
    npLeds.forEach((ledId, k) => {
      if (ledId == null || ledId === 0) return;
      const b = k < npBright.length ? npBright[k] : null;
      records.push({
        phase_index: phase,
        t_start_us: tUs,
        t_end_us: tUs + phaseDur,
        led: ledId,
        brightness: b ?? null,
        light_type: "actinic",
      });
    });

    const pLeds = getSafe(r.pulsed_lights, phase, []);
    const pBright = getSafe(r.pulsed_lights_brightness, phase, []);
    pLeds.forEach((ledId, k) => {
      if (ledId == null || ledId === 0) return;
      const b = k < pBright.length ? pBright[k] : null;
      records.push({
        phase_index: phase,
        t_start_us: tUs,
        t_end_us: tUs + phaseDur,
        led: ledId,
        brightness: b ?? null,
        light_type: "measuring",
      });
    });

    tUs += phaseDur;
  }

  // Fill null actinic / pre_illumination brightness with the runtime pi brightness.
  if (pi && pi.length >= 2 && isFiniteNumber(pi[1])) {
    const piBrightness = Math.round(pi[1]);
    for (const rec of records) {
      if (
        (rec.light_type === "actinic" || rec.light_type === "pre_illumination") &&
        rec.brightness == null
      ) {
        rec.brightness = piBrightness;
      }
    }
  }
  // Coerce any non-integer brightness to integer; unresolvable strings become null.
  for (const rec of records) {
    if (rec.brightness != null && !Number.isInteger(rec.brightness)) {
      rec.brightness = isFiniteNumber(rec.brightness) ? Math.round(rec.brightness) : null;
    }
  }
  return records;
}

function explodeV1Item(
  item: Record<string, unknown>,
  measurementId: string | null,
  projectId: string | null,
  index: number,
): SubProtocolRecord {
  const { data_raw, protocol_id, time, time_offset, ...rest } = item;
  const dataRaw = Array.isArray(data_raw) ? data_raw.filter(isFiniteNumber).map(Math.trunc) : [];
  return {
    measurement_id: measurementId,
    project_id: projectId,
    protocol_id: isFiniteNumber(protocol_id) ? Math.trunc(protocol_id) : null,
    sub_protocol_index: index,
    label: "",
    data_raw: dataRaw,
    data_raw_len: dataRaw.length,
    time: isFiniteNumber(time) ? Math.trunc(time) : null,
    time_offset: isFiniteNumber(time_offset) ? Math.trunc(time_offset) : null,
    pi_json: null,
    metadata_json: JSON.stringify(rest),
  };
}

function explodeV2Item(
  item: Record<string, unknown>,
  measurementId: string | null,
  projectId: string | null,
): SubProtocolRecord[] {
  const protocolId = item.protocol_id;
  const time = item.time;
  const sets = Array.isArray(item.set) ? item.set : [];
  return sets.flatMap((s, idx) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return [];
    const setObj = s as Record<string, unknown>;
    const { label, data_raw, pi, ...rest } = setObj;
    const dataRaw = Array.isArray(data_raw) ? data_raw.filter(isFiniteNumber).map(Math.trunc) : [];
    return [
      {
        measurement_id: measurementId,
        project_id: projectId,
        protocol_id: isFiniteNumber(protocolId) ? Math.trunc(protocolId) : null,
        sub_protocol_index: idx,
        label: typeof label === "string" ? label : "",
        data_raw: dataRaw,
        data_raw_len: dataRaw.length,
        time: isFiniteNumber(time) ? Math.trunc(time) : null,
        time_offset: null,
        pi_json: pi == null ? null : JSON.stringify(pi),
        metadata_json: JSON.stringify(rest),
      },
    ];
  });
}

export function explodeRecords(measurement: MeasurementInput): SubProtocolRecord[] {
  const raw = measurement.sample_raw;
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  const items = parsed as unknown[];

  const measurementId = measurement.measurement_id ?? null;
  const projectId = measurement.project_id ?? null;

  const first = items[0];
  if (
    items.length === 1 &&
    first != null &&
    typeof first === "object" &&
    !Array.isArray(first) &&
    "set" in first
  ) {
    return explodeV2Item(first as Record<string, unknown>, measurementId, projectId);
  }

  const out: SubProtocolRecord[] = [];
  items.forEach((item, idx) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    out.push(explodeV1Item(item as Record<string, unknown>, measurementId, projectId, idx));
  });
  return out;
}

function parseETimeUs(metadataJson: string | null): number | null {
  if (!metadataJson) return null;
  let meta: unknown;
  try {
    meta = JSON.parse(metadataJson) as unknown;
  } catch {
    return null;
  }
  if (!meta || typeof meta !== "object") return null;
  const eTime = (meta as Record<string, unknown>).e_time;
  if (!Array.isArray(eTime) || eTime.length < 2) return null;
  const ms: unknown = eTime[1];
  return isFiniteNumber(ms) ? Math.trunc(ms) * 1000 : null;
}

export interface MeasurementTimeseries {
  inputs: InputRecord[];
  outputs: OutputRecord[];
  /** Wall-clock duration in microseconds, taken from the latest marker
   * (start_time/end_time/f_start_time/...). Useful for sizing the x-axis when
   * trailing sub-protocols (e.g. SPAD) emit no data_raw. */
  totalDurationUs: number;
}

export function measurementToTimeseries(
  measurement: MeasurementInput,
  protocolJson: ProtocolJson,
): MeasurementTimeseries {
  const pset = protocolJson._protocol_set_ ?? [];
  const setByLabel = new Map<string, ProtocolSetEntry>();
  for (const ps of pset) if (ps.label) setByLabel.set(ps.label, ps);

  const allRecords = explodeRecords(measurement);

  // A wall-clock marker is any record without data_raw that carries an e_time
  // ([overflow, ms]). The device emits these at start/end and around fast
  // (`f_*`) sub-protocols. Anchoring t_offset on every marker — not just
  // start_time/end_time — keeps long device-only intervals (e.g. an f_transient
  // that takes 10s but only emits 100 samples) from collapsing.
  const isMarker = (r: SubProtocolRecord) =>
    r.data_raw_len === 0 && parseETimeUs(r.metadata_json) != null;

  let wallClockZero: number | null = null;
  for (const r of allRecords) {
    if (isMarker(r)) {
      const t = parseETimeUs(r.metadata_json);
      if (t != null) {
        wallClockZero = t;
        break;
      }
    }
  }

  // Disambiguate repeated labels with " #N" suffixes.
  const labelCounts = new Map<string, number>();
  for (const r of allRecords) {
    if (r.data_raw_len > 0 && setByLabel.has(r.label)) {
      labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    }
  }
  const repeatedLabels = new Set<string>();
  for (const [lbl, cnt] of labelCounts) if (cnt > 1) repeatedLabels.add(lbl);

  const allInputs: InputRecord[] = [];
  const allOutputs: OutputRecord[] = [];
  let tOffset = 0;
  const labelSeen = new Map<string, number>();
  let ambientPi: unknown[] | null = null;

  for (const row of allRecords) {
    if (isMarker(row)) {
      if (wallClockZero != null) {
        const t = parseETimeUs(row.metadata_json);
        if (t != null) tOffset = Math.max(tOffset, t - wallClockZero);
      }
      continue;
    }

    const psDef = setByLabel.get(row.label);

    if (psDef) {
      const delayS = psDef.protocols_delay;
      if (isFiniteNumber(delayS) && delayS > 0) tOffset += Math.trunc(delayS * 1_000_000);
    }

    if (row.data_raw_len === 0 || !psDef) continue;

    const occurrence = labelSeen.get(row.label) ?? 0;
    labelSeen.set(row.label, occurrence + 1);
    const label = repeatedLabels.has(row.label) ? `${row.label} #${occurrence}` : row.label;

    // `@sX` resolves to v_arrays[X][occurrence], so each set repeat picks its
    // own value (e.g. f_transient runs 20 pulses on repeat 0, 100 on repeat 1).
    const variables = resolveVariables(protocolJson, occurrence);

    let pi: unknown[] | null = null;
    if (row.pi_json) {
      try {
        const parsed = JSON.parse(row.pi_json) as unknown;
        if (Array.isArray(parsed)) pi = parsed;
      } catch {
        pi = null;
      }
    }
    if (pi != null && ambientPi == null) ambientPi = pi;
    const effectivePi = pi ?? ambientPi;

    const outputs = outputRecords(row.data_raw, psDef, variables);
    if (outputs.length === 0) continue;

    const inputs = inputRecords(psDef, variables, protocolJson, effectivePi);
    const subDur = inputs.reduce((m, r) => Math.max(m, r.t_end_us), 0);
    const preIllumDur = inputs
      .filter((r) => r.light_type === "pre_illumination")
      .reduce((m, r) => Math.max(m, r.t_end_us), 0);

    for (const r of inputs) {
      r.sub_protocol = label;
      r.t_start_us += tOffset;
      r.t_end_us += tOffset;
    }
    for (const r of outputs) {
      r.sub_protocol = label;
      r.timestamp_us += preIllumDur + tOffset;
    }

    allInputs.push(...inputs);
    allOutputs.push(...outputs);
    tOffset += subDur;
  }

  // Wall-clock markers (e.g. f_start_time around f_transient) often span longer
  // than the declared phase duration — the device sits idle (or actinic-only)
  // for the remainder. Extend each sub-protocol's last actinic LED phase up to
  // the next sub-protocol's start (or totalDuration) so the LED background
  // covers the full device window instead of leaving a visual gap.
  const spans = new Map<string, { start: number; end: number }>();
  for (const r of allInputs) {
    if (!r.sub_protocol) continue;
    const span = spans.get(r.sub_protocol);
    if (!span) spans.set(r.sub_protocol, { start: r.t_start_us, end: r.t_end_us });
    else {
      span.start = Math.min(span.start, r.t_start_us);
      span.end = Math.max(span.end, r.t_end_us);
    }
  }
  const ordered = Array.from(spans.entries()).sort((a, b) => a[1].start - b[1].start);
  for (let i = 0; i < ordered.length; i++) {
    const [name, span] = ordered[i] as [string, { start: number; end: number }];
    const nextStart =
      i + 1 < ordered.length
        ? (ordered[i + 1] as [string, { start: number; end: number }])[1].start
        : tOffset;
    if (nextStart <= span.end) continue;
    for (const r of allInputs) {
      if (r.sub_protocol === name && r.t_end_us === span.end && r.light_type === "actinic") {
        r.t_end_us = nextStart;
      }
    }
  }

  // Anchor the time axis to the first record so charts always start at t=0,
  // not at "however long the user took to click Run after start_time fired".
  // Wall-clock markers determine the true device idle time *between* sub-
  // protocols; the slack *before* the first sub-protocol is just user delay
  // and shouldn't show up as empty space on the left of the chart.
  let zeroOffset = Infinity;
  for (const r of allInputs) if (r.t_start_us < zeroOffset) zeroOffset = r.t_start_us;
  for (const r of allOutputs) if (r.timestamp_us < zeroOffset) zeroOffset = r.timestamp_us;
  if (zeroOffset !== Infinity && zeroOffset > 0) {
    for (const r of allInputs) {
      r.t_start_us -= zeroOffset;
      r.t_end_us -= zeroOffset;
    }
    for (const r of allOutputs) r.timestamp_us -= zeroOffset;
    tOffset -= zeroOffset;
  }

  return { inputs: allInputs, outputs: allOutputs, totalDurationUs: tOffset };
}
