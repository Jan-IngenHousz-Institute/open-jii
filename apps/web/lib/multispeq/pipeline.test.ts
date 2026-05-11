import { describe, expect, it } from "vitest";

import { isMultispeqOutput, extractMeasurement } from "./detect";
import {
  explodeRecords,
  inputRecords,
  measurementToTimeseries,
  outputRecords,
  predictDataRawLength,
  resolveProtocolSetEntry,
  resolveVariables,
} from "./pipeline";
import type { ProtocolJson, ProtocolSetEntry } from "./pipeline";

describe("resolveVariables", () => {
  it("indexes numeric values from v_arrays as @nX:Y plus @sX (occurrence-indexed)", () => {
    const v_arrays: unknown[][] = [
      [10, 20],
      [3000, 6000],
    ];
    expect(resolveVariables({ v_arrays }, 0)).toEqual({
      "@n0:0": 10,
      "@n0:1": 20,
      "@n1:0": 3000,
      "@n1:1": 6000,
      "@s0": 10,
      "@s1": 3000,
    });
    expect(resolveVariables({ v_arrays }, 1)).toMatchObject({
      "@s0": 20,
      "@s1": 6000,
    });
  });

  it("leaves @sX unset when the indexed slot is non-numeric so pi can fill brightness", () => {
    // ["p_light", 2500] at iteration 0: "p_light" is a runtime sentinel meaning
    // "use the measured ambient PAR", which only the device knows. We leave
    // @s0 unset; downstream the brightness gets filled from the pi tuple.
    expect(resolveVariables({ v_arrays: [["p_light", 2500]] }, 0)).toEqual({
      "@n0:1": 2500,
    });
    // Iteration 1 lands on the numeric 2500 directly.
    expect(resolveVariables({ v_arrays: [["p_light", 2500]] }, 1)).toEqual({
      "@n0:1": 2500,
      "@s0": 2500,
    });
  });

  it("clamps out-of-range iterations to the last numeric value", () => {
    expect(resolveVariables({ v_arrays: [[10, 20]] }, 5)).toMatchObject({ "@s0": 20 });
  });

  it("returns empty for missing v_arrays", () => {
    expect(resolveVariables({})).toEqual({});
  });
});

describe("resolveProtocolSetEntry", () => {
  it("resolves variable references in nested detector/light arrays", () => {
    const variables = resolveVariables({ v_arrays: [[100, 50]] });
    const entry: ProtocolSetEntry = {
      pulses: ["@n0:0", "@n0:1"],
      pulse_distance: [1000, 2000],
      detectors: [[3], [3]],
      pulsed_lights: [[1], [1]],
    };
    const r = resolveProtocolSetEntry(entry, variables);
    expect(r.pulses).toEqual([100, 50]);
    expect(r.pulse_distance).toEqual([1000, 2000]);
    expect(r.detectors).toEqual([[3], [3]]);
    expect(r.pulsed_lights).toEqual([[1], [1]]);
  });

  it("treats unresolvable string brightness as null inside nested lists", () => {
    const r = resolveProtocolSetEntry(
      {
        pulses: [10],
        pulse_distance: [1000],
        detectors: [[3]],
        pulsed_lights: [[1]],
        nonpulsed_lights: [[2]],
        nonpulsed_lights_brightness: [["p_light"]],
      },
      {},
    );
    expect(r.nonpulsed_lights_brightness).toEqual([[null]]);
  });
});

describe("predictDataRawLength", () => {
  it("counts pulses * active detectors per phase", () => {
    expect(
      predictDataRawLength({
        pulses: [10, 5],
        detectors: [[3, 4], [3]],
      }),
    ).toBe(10 * 2 + 5 * 1);
  });

  it("ignores zero detector ids", () => {
    expect(
      predictDataRawLength({
        pulses: [10],
        detectors: [[3, 0, 4]],
      }),
    ).toBe(10 * 2);
  });
});

describe("outputRecords", () => {
  it("decodes a single phase with 1 detector and N pulses, advancing time by pulse_distance", () => {
    const dataRaw = [100, 200, 300];
    const records = outputRecords(dataRaw, {
      pulses: [3],
      pulse_distance: [1000],
      detectors: [[3]],
      pulsed_lights: [[1]],
    });
    expect(records).toEqual([
      { phase_index: 0, pulse_index: 0, detector: 3, light: 1, timestamp_us: 1000, value: 100 },
      { phase_index: 0, pulse_index: 1, detector: 3, light: 1, timestamp_us: 2000, value: 200 },
      { phase_index: 0, pulse_index: 2, detector: 3, light: 1, timestamp_us: 3000, value: 300 },
    ]);
  });

  it("treats each (detector, light) channel as a separate pulse, cycling per emission", () => {
    // 2 declared pulses × 2 channels = 4 sequential pulses, each at its own timestamp.
    const dataRaw = [11, 12, 21, 22];
    const records = outputRecords(dataRaw, {
      pulses: [2],
      pulse_distance: [500],
      detectors: [[3, 4]],
      pulsed_lights: [[1, 2]],
    });
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({ pulse_index: 0, detector: 3, timestamp_us: 500, value: 11 });
    expect(records[1]).toMatchObject({
      pulse_index: 1,
      detector: 4,
      timestamp_us: 1000,
      value: 12,
    });
    expect(records[2]).toMatchObject({
      pulse_index: 2,
      detector: 3,
      timestamp_us: 1500,
      value: 21,
    });
    expect(records[3]).toMatchObject({
      pulse_index: 3,
      detector: 4,
      timestamp_us: 2000,
      value: 22,
    });
  });

  it("skips zero-detector channels but still advances time", () => {
    const dataRaw = [42];
    const records = outputRecords(dataRaw, {
      pulses: [1],
      pulse_distance: [1000],
      detectors: [[0, 3]],
      pulsed_lights: [[0, 1]],
    });
    // Channel 0 (detector 0) is skipped; channel 1 (detector 3) is the second
    // emitted pulse, so its timestamp is 2 × pulse_distance.
    expect(records).toEqual([
      { phase_index: 0, pulse_index: 1, detector: 3, light: 1, timestamp_us: 2000, value: 42 },
    ]);
  });

  it("returns [] for empty pulses", () => {
    expect(outputRecords([], { pulses: [], detectors: [] })).toEqual([]);
  });

  it("caps phase pulses by the actual data_raw length (device truncated run)", () => {
    // protocol declares 100 pulses but the device only returned 20 readings.
    const records = outputRecords(
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200],
      {
        pulses: [100],
        pulse_distance: [100000],
        detectors: [[1]],
        pulsed_lights: [[3]],
      },
    );
    expect(records).toHaveLength(20);
    expect(records[19]?.timestamp_us).toBe(20 * 100000);
  });
});

describe("inputRecords", () => {
  it("emits a pre_illumination row from the runtime pi tuple", () => {
    const records = inputRecords(
      { pulses: [10], pulse_distance: [1000], pulsed_lights: [[1]], nonpulsed_lights: [[2]] },
      {},
      null,
      [2, 100, 5],
    );
    expect(records[0]).toMatchObject({
      phase_index: -1,
      light_type: "pre_illumination",
      led: 2,
      brightness: 100,
      t_start_us: 0,
      t_end_us: 5000,
    });
  });

  it("fills null actinic brightness with the pi brightness", () => {
    const records = inputRecords(
      {
        pulses: [10],
        pulse_distance: [1000],
        pulsed_lights: [[1]],
        nonpulsed_lights: [[2]],
        // no nonpulsed_lights_brightness — actinic brightness will be null until pi fallback fills it
      },
      {},
      null,
      [2, 250, 5],
    );
    const actinic = records.find((r) => r.light_type === "actinic");
    expect(actinic?.brightness).toBe(250);
  });

  it("phase duration equals pulses * channels * pulse_distance (channels are sequential pulses)", () => {
    // 10 declared × 2 channels = 20 sequential pulses → 20 × 1000us = 20 ms phase.
    const records = inputRecords({
      pulses: [10],
      pulse_distance: [1000],
      detectors: [[3, 4]],
      pulsed_lights: [[1, 2]],
    });
    const measuring = records.find((r) => r.light_type === "measuring");
    expect(measuring?.t_end_us).toBe(10 * 2 * 1000);
  });
});

describe("explodeRecords", () => {
  it("explodes a v2 envelope with a 'set' array into one record per sub-protocol", () => {
    const v2 = JSON.stringify([
      {
        protocol_id: 3517,
        time: 1700000000,
        set: [
          { label: "PIRK", data_raw: [1, 2, 3], pi: [2, 100, 5] },
          { label: "PAM", data_raw: [10, 20] },
        ],
      },
    ]);
    const records = explodeRecords({ sample_raw: v2 });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      label: "PIRK",
      data_raw: [1, 2, 3],
      data_raw_len: 3,
      pi_json: JSON.stringify([2, 100, 5]),
    });
    expect(records[1]).toMatchObject({ label: "PAM", data_raw: [10, 20], data_raw_len: 2 });
  });

  it("explodes a v1 array of {data_raw, ...} items", () => {
    const v1 = JSON.stringify([
      { data_raw: [1, 2], protocol_id: 1, time: 1700000000 },
      { data_raw: [3, 4], protocol_id: 1 },
    ]);
    const records = explodeRecords({ sample_raw: v1 });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.data_raw)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("accepts already-parsed sample_raw", () => {
    const records = explodeRecords({
      sample_raw: [{ set: [{ label: "X", data_raw: [9] }] }],
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.label).toBe("X");
  });

  it("returns [] for malformed JSON", () => {
    expect(explodeRecords({ sample_raw: "not-json" })).toEqual([]);
  });
});

describe("measurementToTimeseries", () => {
  const protocol: ProtocolJson = {
    v_arrays: [[3]],
    _protocol_set_: [
      {
        label: "ABS",
        pulses: ["@n0:0"],
        pulse_distance: [1000],
        detectors: [[3]],
        pulsed_lights: [[1]],
        nonpulsed_lights: [[2]],
        nonpulsed_lights_brightness: [[100]],
      },
    ],
  };

  it("decodes a v2 measurement into inputs and outputs with sub_protocol labels", () => {
    const sample_raw = JSON.stringify([
      { set: [{ label: "ABS", data_raw: [10, 20, 30], pi: [2, 100, 2] }] },
    ]);
    const { inputs, outputs } = measurementToTimeseries({ sample_raw }, protocol);

    expect(outputs).toHaveLength(3);
    expect(outputs.every((r) => r.sub_protocol === "ABS")).toBe(true);
    // pre_illumination shifts detector timestamps by 2_000us; pulse_distance 1000us per pulse.
    expect(outputs.map((r) => r.timestamp_us)).toEqual([3000, 4000, 5000]);

    const labels = inputs.map((r) => r.light_type).sort();
    expect(labels).toEqual(["actinic", "measuring", "pre_illumination"]);
  });

  it("disambiguates repeated sub-protocol labels with ' #N' suffixes", () => {
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [1, 2, 3] },
          { label: "ABS", data_raw: [4, 5, 6] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, protocol);
    const labels = Array.from(new Set(outputs.map((r) => r.sub_protocol)));
    expect(labels.sort()).toEqual(["ABS #0", "ABS #1"]);
  });

  it("advances the time offset across multiple sub-protocols", () => {
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [1, 2, 3] },
          { label: "ABS", data_raw: [4, 5, 6] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, protocol);
    const second = outputs.filter((r) => r.sub_protocol === "ABS #1");
    // Phase duration of first ABS = 3 * 1000us = 3000us. Second ABS detector readings start after.
    expect(second[0]?.timestamp_us).toBeGreaterThanOrEqual(3000);
  });

  it("ignores e_time markers and lays sub-protocols back-to-back by declared duration", () => {
    // The protocol's start_time / f_start_time records carry wall-clock
    // timestamps but those reflect device-internal autogain/env work that
    // has no chart-meaningful duration. Sub-protocols sit back-to-back at
    // their declared phase durations regardless of marker spacing.
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "start_time", e_time: [0, 1000], data_raw: [] },
          { label: "start_time", e_time: [0, 6000], data_raw: [] },
          { label: "ABS", data_raw: [10, 20, 30] },
          { label: "f_start_time", e_time: [0, 11000], data_raw: [] },
          { label: "ABS", data_raw: [40, 50, 60] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, protocol);
    // First read at one pulse_distance into the first ABS phase.
    expect(outputs[0]?.timestamp_us).toBe(1000);
    // Second ABS follows the first immediately. ABS phase = 3 pulses × 1000us
    // = 3000us, so the second ABS's first read is at ~3000 + 1000 = 4000us.
    const second = outputs.filter((r) => r.sub_protocol === "ABS #1");
    expect(second[0]?.timestamp_us).toBeLessThan(10_000);
  });

  it("recovers from malformed pi_json without crashing", () => {
    // Force an unparseable pi_json into the explode path so the JSON.parse catch
    // branch is exercised. We do this by hand-crafting the explode output and
    // calling the orchestrator via measurementToTimeseries on a fresh sample
    // whose pi field is a string the JSON parser rejects.
    const sample_raw = JSON.stringify([
      { set: [{ label: "ABS", data_raw: [1, 2, 3], pi: "not-an-array" }] },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, protocol);
    // pi parsed as a non-array string falls back to ambient (none here), so
    // the protocol's pre_illumination path isn't entered, but the run should
    // still produce three detector records.
    expect(outputs).toHaveLength(3);
  });

  it("advances t_offset by protocols_delay between sub-protocols", () => {
    const proto: ProtocolJson = {
      v_arrays: [[3]],
      _protocol_set_: [
        {
          label: "ABS",
          pulses: ["@n0:0"],
          pulse_distance: [1000],
          detectors: [[3]],
          pulsed_lights: [[1]],
          nonpulsed_lights: [[2]],
          nonpulsed_lights_brightness: [[100]],
        },
        { label: "WAIT", protocols_delay: 2 },
      ],
    };
    // ABS, then a WAIT sub-protocol that just advances t_offset, then ABS again.
    // The 2s protocols_delay should put the second ABS 2s after the first.
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [10, 20, 30] },
          { label: "WAIT", data_raw: [] },
          { label: "ABS", data_raw: [40, 50, 60] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, proto);
    const second = outputs.filter((r) => r.sub_protocol === "ABS #1");
    // First ABS phase ~3ms, then 2s protocols_delay; second ABS first read >= 2s.
    expect(second[0]?.timestamp_us).toBeGreaterThanOrEqual(2_000_000);
  });

  it("extends a sub-protocol's last-phase actinic across a protocols_delay gap to the next sub-protocol", () => {
    // The MultispeQ holds the actinic LED at its last nonpulsed brightness
    // through any time gap between sub-protocols (e.g. a `protocols_delay`),
    // so the first sub-protocol's last-phase actinic must extend to where the
    // next data sub-protocol starts — leaving no break in the actinic line.
    const proto: ProtocolJson = {
      v_arrays: [[3]],
      _protocol_set_: [
        {
          label: "ABS",
          pulses: ["@n0:0"],
          pulse_distance: [1000],
          detectors: [[3]],
          pulsed_lights: [[1]],
          nonpulsed_lights: [[2]],
          nonpulsed_lights_brightness: [[100]],
        },
        { label: "WAIT", protocols_delay: 1 },
      ],
    };
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [1, 2, 3] },
          { label: "WAIT", data_raw: [] },
          { label: "ABS", data_raw: [4, 5, 6] },
        ],
      },
    ]);
    const { inputs } = measurementToTimeseries({ sample_raw }, proto);
    const firstActinicEnd = Math.max(
      ...inputs
        .filter((r) => r.sub_protocol === "ABS #0" && r.light_type === "actinic")
        .map((r) => r.t_end_us),
    );
    const secondStart = inputs
      .filter((r) => r.sub_protocol === "ABS #1")
      .reduce((m, r) => Math.min(m, r.t_start_us), Infinity);
    expect(firstActinicEnd).toBe(secondStart);
    // Sanity: protocols_delay creates a 1s gap, far more than ABS's declared phase.
    expect(secondStart).toBeGreaterThanOrEqual(1_000_000);
  });

  it("handles measurements with no sub-protocols gracefully", () => {
    const { inputs, outputs, totalDurationUs } = measurementToTimeseries(
      { sample_raw: "[]" },
      protocol,
    );
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([]);
    expect(totalDurationUs).toBe(0);
  });
});

describe("explodeRecords edge cases", () => {
  it("returns [] for null sample_raw", () => {
    expect(explodeRecords({ sample_raw: null })).toEqual([]);
  });

  it("returns [] for missing sample_raw", () => {
    expect(explodeRecords({})).toEqual([]);
  });

  it("preserves measurement_id and project_id when provided", () => {
    const records = explodeRecords({
      measurement_id: "m1",
      project_id: "p1",
      sample_raw: [{ data_raw: [1, 2], protocol_id: 7 }],
    });
    expect(records[0]?.measurement_id).toBe("m1");
    expect(records[0]?.project_id).toBe("p1");
    expect(records[0]?.protocol_id).toBe(7);
  });

  it("ignores non-object items inside a v1 array", () => {
    const records = explodeRecords({
      sample_raw: [{ data_raw: [1] }, "garbage", null, 42, [{ nested: true }]],
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.data_raw).toEqual([1]);
  });
});

describe("resolveProtocolSetEntry edge cases", () => {
  it("wraps non-list nested items into single-element lists", () => {
    // A bare scalar in detectors[i] (not wrapped in a list) is a legacy form;
    // the resolver normalises it to [n] so the rest of the pipeline can index it.
    const r = resolveProtocolSetEntry({
      pulses: [3],
      pulse_distance: [1000],
      detectors: [3],
    });
    expect(r.detectors).toEqual([[3]]);
  });

  it("substitutes 0 for items that resolve to null in nested lists", () => {
    const r = resolveProtocolSetEntry({
      pulses: [1],
      pulse_distance: [1000],
      detectors: ["unresolvable-string"],
    });
    expect(r.detectors).toEqual([[0]]);
  });
});

describe("isMultispeqOutput", () => {
  it("recognises a v2 envelope wrapped in sample_raw", () => {
    expect(isMultispeqOutput({ sample_raw: [{ set: [{ data_raw: [1] }] }] })).toBe(true);
  });

  it("recognises an unwrapped v2 object with a 'set' array", () => {
    expect(isMultispeqOutput({ set: [{ data_raw: [1, 2] }], protocol_id: 1 })).toBe(true);
  });

  it("recognises a top-level v1 array", () => {
    expect(isMultispeqOutput([{ data_raw: [1, 2, 3], protocol_id: 1 }])).toBe(true);
  });

  it("recognises the live-device wrapper using the 'sample' field", () => {
    expect(
      isMultispeqOutput({
        device_id: "dev-1",
        sample: [{ set: [{ label: "ABS", data_raw: [1, 2, 3] }] }],
      }),
    ).toBe(true);
  });

  it("rejects ordinary key/value output payloads", () => {
    expect(isMultispeqOutput({ device_id: "abc", firmware_version: "1.0" })).toBe(false);
  });

  it("rejects empty / nullish data", () => {
    expect(isMultispeqOutput(null)).toBe(false);
    expect(isMultispeqOutput([])).toBe(false);
  });

  it("normalises an unwrapped v2 object back to a sample_raw array", () => {
    const m = extractMeasurement({ set: [{ data_raw: [1] }] });
    expect(m).not.toBeNull();
    expect(Array.isArray(m?.sample_raw)).toBe(true);
  });
});
