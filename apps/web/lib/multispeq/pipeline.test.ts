import { describe, expect, it } from "vitest";

import { isMultispeqOutput, extractMeasurement } from "./detect";
import {
  explodeRecords,
  inputRecords,
  measurementToTimeseries,
  outputRecords,
  predictDataRawLength,
  resolveCommandSetEntry,
  resolveVariables,
} from "./pipeline";
import type { CommandJson, CommandSetEntry } from "./pipeline";

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

describe("resolveCommandSetEntry", () => {
  it("resolves variable references in nested detector/light arrays", () => {
    const variables = resolveVariables({ v_arrays: [[100, 50]] });
    const entry: CommandSetEntry = {
      pulses: ["@n0:0", "@n0:1"],
      pulse_distance: [1000, 2000],
      detectors: [[3], [3]],
      pulsed_lights: [[1], [1]],
    };
    const r = resolveCommandSetEntry(entry, variables);
    expect(r.pulses).toEqual([100, 50]);
    expect(r.pulse_distance).toEqual([1000, 2000]);
    expect(r.detectors).toEqual([[3], [3]]);
    expect(r.pulsed_lights).toEqual([[1], [1]]);
  });

  it("treats unresolvable string brightness as null inside nested lists", () => {
    const r = resolveCommandSetEntry(
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
    // command declares 100 pulses but the device only returned 20 readings.
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
        // no nonpulsed_lights_brightness - actinic brightness will be null until pi fallback fills it
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

  it("expands entry.pre_illumination via @s array refs when no runtime pi is supplied", () => {
    // pre_illumination = [led, brightness_arr_ref, duration_arr_ref]. With
    // "@s1" / "@s2" the arrays come from v_arrays; we pair them position-wise.
    const proto: CommandJson = {
      v_arrays: [[], [100, 200, 300], [5, 10, 15]],
    };
    const records = inputRecords(
      {
        pulses: [],
        pre_illumination: [2, "@s1", "@s2"],
      },
      {},
      proto,
      null,
    );
    const preIllum = records.filter((r) => r.light_type === "pre_illumination");
    expect(preIllum).toHaveLength(3);
    expect(preIllum[0]).toMatchObject({ led: 2, brightness: 100, t_end_us: 5000 });
    expect(preIllum[1]).toMatchObject({ led: 2, brightness: 200, t_end_us: 5000 + 10_000 });
    expect(preIllum[2]).toMatchObject({
      led: 2,
      brightness: 300,
      t_end_us: 5000 + 10_000 + 15_000,
    });
  });

  it("clamps short pre_illumination arrays by repeating the last value", () => {
    // brightnesses has 1 entry, durations has 3 - len = 3 and the brightness
    // clamps to the last value for the trailing iterations.
    const proto: CommandJson = { v_arrays: [] };
    const records = inputRecords(
      {
        pulses: [],
        pre_illumination: [4, [50], [10, 20, 30]],
      },
      {},
      proto,
      null,
    );
    const preIllum = records.filter((r) => r.light_type === "pre_illumination");
    expect(preIllum.map((r) => r.brightness)).toEqual([50, 50, 50]);
    expect(preIllum.map((r) => (r.t_end_us - r.t_start_us) / 1000)).toEqual([10, 20, 30]);
  });

  it("accepts scalar pre_illumination brightness/duration as single-element lists", () => {
    // Plain scalar values (not arrays, not @s refs) become a 1-step pre_illum.
    const proto: CommandJson = { v_arrays: [] };
    const records = inputRecords({ pulses: [], pre_illumination: [5, 75, 20] }, {}, proto, null);
    const preIllum = records.filter((r) => r.light_type === "pre_illumination");
    expect(preIllum).toHaveLength(1);
    expect(preIllum[0]).toMatchObject({ led: 5, brightness: 75, t_end_us: 20_000 });
  });

  it("treats out-of-range @s references in pre_illumination as empty arrays", () => {
    // `@s99` with no matching v_arrays slot yields an empty array, which
    // collapses the loop to zero pre_illumination steps.
    const proto: CommandJson = { v_arrays: [] };
    const records = inputRecords(
      { pulses: [], pre_illumination: [3, "@s99", "@s99"] },
      {},
      proto,
      null,
    );
    expect(records.filter((r) => r.light_type === "pre_illumination")).toHaveLength(0);
  });

  it("reuses the last pulse_distance value when the array is shorter than pulses", () => {
    // Commands sometimes declare 1 pulse_distance for multiple phases; the
    // getSafe fallback should clamp to the last value rather than treat
    // overflow phases as zero-distance.
    const records = inputRecords({
      pulses: [2, 3],
      pulse_distance: [1000],
      detectors: [[3], [3]],
      pulsed_lights: [[1], [1]],
      nonpulsed_lights: [[2], [2]],
    });
    const actinic = records.filter((r) => r.light_type === "actinic");
    expect(actinic[0]?.t_end_us).toBe(2 * 1000);
    expect(actinic[1]?.t_end_us).toBe(2 * 1000 + 3 * 1000);
  });

  it("skips LED 0 entries in both nonpulsed and pulsed light lists", () => {
    // An explicit 0 LED id means "no LED here"; the channel is skipped
    // entirely so the records list stays clean of phantom entries.
    const records = inputRecords({
      pulses: [1],
      pulse_distance: [1000],
      detectors: [[3]],
      pulsed_lights: [[0]],
      nonpulsed_lights: [[0]],
    });
    expect(records.filter((r) => r.light_type === "actinic")).toHaveLength(0);
    expect(records.filter((r) => r.light_type === "measuring")).toHaveLength(0);
  });
});

describe("explodeRecords", () => {
  it("explodes a v2 envelope with a 'set' array into one record per sub-command", () => {
    const v2 = JSON.stringify([
      {
        command_id: 3517,
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
      { data_raw: [1, 2], command_id: 1, time: 1700000000 },
      { data_raw: [3, 4], command_id: 1 },
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

  it("explodes multi-item v2 arrays (each item carries its own 'set')", () => {
    // Each compound command contributes its own sets; sub_command_index
    // remains globally unique by offsetting the second item's inner indices.
    const v2Multi = JSON.stringify([
      { command_id: 1, time: 1700000000, set: [{ label: "A", data_raw: [1] }] },
      {
        command_id: 2,
        time: 1700000001,
        set: [
          { label: "B", data_raw: [2, 3] },
          { label: "C", data_raw: [4] },
        ],
      },
    ]);
    const records = explodeRecords({ sample_raw: v2Multi });
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.label)).toEqual(["A", "B", "C"]);
    expect(records.map((r) => r.sub_command_index)).toEqual([0, 1, 2]);
    expect(records[1]?.command_id).toBe(2);
  });

  it("preserves valid v2 records when the top-level array mixes v1 and v2 items", () => {
    // A stray v1 item between two v2 items shouldn't make the parser drop the
    // nested set data - each item is decoded by its own shape.
    const mixed = JSON.stringify([
      { command_id: 1, set: [{ label: "A", data_raw: [1] }] },
      { command_id: 2, data_raw: [9, 8, 7] },
      { command_id: 3, set: [{ label: "B", data_raw: [2, 3] }] },
    ]);
    const records = explodeRecords({ sample_raw: mixed });
    expect(records).toHaveLength(3);
    const labels = records.map((r) => r.label);
    expect(labels).toContain("A");
    expect(labels).toContain("B");
    const v1Row = records.find((r) => r.label === "");
    expect(v1Row?.data_raw).toEqual([9, 8, 7]);
  });
});

describe("measurementToTimeseries", () => {
  const command: CommandJson = {
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

  it("decodes a v2 measurement into inputs and outputs with sub_command labels", () => {
    const sample_raw = JSON.stringify([
      { set: [{ label: "ABS", data_raw: [10, 20, 30], pi: [2, 100, 2] }] },
    ]);
    const { inputs, outputs } = measurementToTimeseries({ sample_raw }, command);

    expect(outputs).toHaveLength(3);
    expect(outputs.every((r) => r.sub_command === "ABS")).toBe(true);
    // pre_illumination shifts detector timestamps by 2_000us; pulse_distance 1000us per pulse.
    expect(outputs.map((r) => r.timestamp_us)).toEqual([3000, 4000, 5000]);

    const labels = inputs.map((r) => r.light_type).sort();
    expect(labels).toEqual(["actinic", "measuring", "pre_illumination"]);
  });

  it("disambiguates repeated sub-command labels with ' #N' suffixes", () => {
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [1, 2, 3] },
          { label: "ABS", data_raw: [4, 5, 6] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, command);
    const labels = Array.from(new Set(outputs.map((r) => r.sub_command)));
    expect(labels.sort()).toEqual(["ABS #0", "ABS #1"]);
  });

  it("advances the time offset across multiple sub-commands", () => {
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "ABS", data_raw: [1, 2, 3] },
          { label: "ABS", data_raw: [4, 5, 6] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, command);
    const second = outputs.filter((r) => r.sub_command === "ABS #1");
    // Phase duration of first ABS = 3 * 1000us = 3000us. Second ABS detector readings start after.
    expect(second[0]?.timestamp_us).toBeGreaterThanOrEqual(3000);
  });

  it("ignores e_time markers and lays sub-commands back-to-back by declared duration", () => {
    // The command's start_time / f_start_time records carry wall-clock
    // timestamps but those reflect device-internal autogain/env work that
    // has no chart-meaningful duration. Sub-commands sit back-to-back at
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
    const { outputs } = measurementToTimeseries({ sample_raw }, command);
    // First read at one pulse_distance into the first ABS phase.
    expect(outputs[0]?.timestamp_us).toBe(1000);
    // Second ABS follows the first immediately. ABS phase = 3 pulses × 1000us
    // = 3000us, so the second ABS's first read is at ~3000 + 1000 = 4000us.
    const second = outputs.filter((r) => r.sub_command === "ABS #1");
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
    const { outputs } = measurementToTimeseries({ sample_raw }, command);
    // pi parsed as a non-array string falls back to ambient (none here), so
    // the command's pre_illumination path isn't entered, but the run should
    // still produce three detector records.
    expect(outputs).toHaveLength(3);
  });

  it("advances t_offset by commands_delay between sub-commands", () => {
    const proto: CommandJson = {
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
        { label: "WAIT", commands_delay: 2 },
      ],
    };
    // ABS, then a WAIT sub-command that just advances t_offset, then ABS again.
    // The 2s commands_delay should put the second ABS 2s after the first.
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
    const second = outputs.filter((r) => r.sub_command === "ABS #1");
    // First ABS phase ~3ms, then 2s commands_delay; second ABS first read >= 2s.
    expect(second[0]?.timestamp_us).toBeGreaterThanOrEqual(2_000_000);
  });

  it("extends a sub-command's last-phase actinic across a commands_delay gap to the next sub-command", () => {
    // The MultispeQ holds the actinic LED at its last nonpulsed brightness
    // through any time gap between sub-commands (e.g. a `commands_delay`),
    // so the first sub-command's last-phase actinic must extend to where the
    // next data sub-command starts - leaving no break in the actinic line.
    const proto: CommandJson = {
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
        { label: "WAIT", commands_delay: 1 },
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
        .filter((r) => r.sub_command === "ABS #0" && r.light_type === "actinic")
        .map((r) => r.t_end_us),
    );
    const secondStart = inputs
      .filter((r) => r.sub_command === "ABS #1")
      .reduce((m, r) => Math.min(m, r.t_start_us), Infinity);
    expect(firstActinicEnd).toBe(secondStart);
    // Sanity: commands_delay creates a 1s gap, far more than ABS's declared phase.
    expect(secondStart).toBeGreaterThanOrEqual(1_000_000);
  });

  it("handles measurements with no sub-commands gracefully", () => {
    const { inputs, outputs, totalDurationUs } = measurementToTimeseries(
      { sample_raw: "[]" },
      command,
    );
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([]);
    expect(totalDurationUs).toBe(0);
  });

  it("shifts the timeline back to t=0 when a commands_delay precedes the first data sub-command", () => {
    const proto: CommandJson = {
      v_arrays: [[3]],
      _protocol_set_: [
        { label: "WAIT", commands_delay: 1 },
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
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "WAIT", data_raw: [] },
          { label: "ABS", data_raw: [1, 2, 3] },
        ],
      },
    ]);
    const { outputs } = measurementToTimeseries({ sample_raw }, proto);
    expect(outputs[0]?.timestamp_us).toBe(1000);
  });

  it("skips actinic extension for sub-commands whose phases have no nonpulsed light", () => {
    // A sub-command that only fires measuring (pulsed) lights produces no
    // actinic records, so there's no record to extend across a delay gap.
    // The pipeline should handle that without crashing or mis-extending.
    const proto: CommandJson = {
      v_arrays: [[2]],
      _protocol_set_: [
        {
          label: "PULSE_ONLY",
          pulses: ["@n0:0"],
          pulse_distance: [1000],
          detectors: [[3]],
          pulsed_lights: [[1]],
        },
        { label: "WAIT", commands_delay: 1 },
        {
          label: "PULSE_ONLY",
          pulses: ["@n0:0"],
          pulse_distance: [1000],
          detectors: [[3]],
          pulsed_lights: [[1]],
        },
      ],
    };
    const sample_raw = JSON.stringify([
      {
        set: [
          { label: "PULSE_ONLY", data_raw: [1, 2] },
          { label: "WAIT", data_raw: [] },
          { label: "PULSE_ONLY", data_raw: [3, 4] },
        ],
      },
    ]);
    const { inputs } = measurementToTimeseries({ sample_raw }, proto);
    expect(inputs.filter((r) => r.light_type === "actinic")).toHaveLength(0);
    expect(inputs.filter((r) => r.light_type === "measuring").length).toBeGreaterThan(0);
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
      sample_raw: [{ data_raw: [1, 2], command_id: 7 }],
    });
    expect(records[0]?.measurement_id).toBe("m1");
    expect(records[0]?.project_id).toBe("p1");
    expect(records[0]?.command_id).toBe(7);
  });

  it("ignores non-object items inside a v1 array", () => {
    const records = explodeRecords({
      sample_raw: [{ data_raw: [1] }, "garbage", null, 42, [{ nested: true }]],
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.data_raw).toEqual([1]);
  });

  it("skips nullish or non-object entries inside a v2 'set' array", () => {
    // Live-device payloads occasionally contain stray null or string entries
    // alongside real sub-command objects; the explode pass should drop them
    // rather than throwing on the missing fields.
    const records = explodeRecords({
      sample_raw: [
        {
          set: [null, "junk", [1, 2], { label: "OK", data_raw: [9] }],
        },
      ],
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ label: "OK", data_raw: [9] });
  });
});

describe("resolveCommandSetEntry edge cases", () => {
  it("wraps non-list nested items into single-element lists", () => {
    // A bare scalar in detectors[i] (not wrapped in a list) is a legacy form;
    // the resolver normalises it to [n] so the rest of the pipeline can index it.
    const r = resolveCommandSetEntry({
      pulses: [3],
      pulse_distance: [1000],
      detectors: [3],
    });
    expect(r.detectors).toEqual([[3]]);
  });

  it("substitutes 0 for items that resolve to null in nested lists", () => {
    const r = resolveCommandSetEntry({
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
    expect(isMultispeqOutput({ set: [{ data_raw: [1, 2] }], command_id: 1 })).toBe(true);
  });

  it("recognises a top-level v1 array", () => {
    expect(isMultispeqOutput([{ data_raw: [1, 2, 3], command_id: 1 }])).toBe(true);
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

  it("recognises a sample array even when the first item is malformed", () => {
    // looksLikeSampleRaw now scans every item, so a leading null doesn't
    // disqualify the rest of the payload.
    expect(
      isMultispeqOutput({
        device_id: "dev-1",
        sample: [null, "junk", { set: [{ data_raw: [1, 2] }] }],
      }),
    ).toBe(true);
  });
});
