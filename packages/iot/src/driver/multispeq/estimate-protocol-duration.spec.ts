import { describe, it, expect } from "vitest";

import {
  computeScanTimeoutMs,
  estimateProtocolDurationMs,
  resolveNumericRef,
  SCAN_TIMEOUT_DEFAULTS,
} from "./estimate-protocol-duration";

/**
 * The real "light response curve" protocol (protocol_id 1547) from OJD-1565.
 * Kept verbatim so the estimate is exercised against a genuine field protocol.
 *
 * Hand-computed expectation (see assertions below):
 *   v_arrays[0].length = 7  → set_repeats
 *   autogain block (no pulses)                         = 3_000 ms  (SETUP_BLOCK_MS)
 *   ecs_dirk:  (400×1500µs)=600ms + 5000ms preillum, ×3 repeats = 16_800 ms
 *   ftrans:    (300×4000µs)=1200ms + 5000ms preillum, ×1 repeat =  6_200 ms
 *   per run = 26_000 ms  →  ×7 = 182_000 ms
 */
const LIGHT_RESPONSE_CURVE = [
  {
    _protocol_set_: [
      { autogain: [[1, 1, 3, 10, 50000]], do_once: 1, e_time: 1, label: "autogain" },
      {
        detectors: [[3], [3], [3]],
        e_time: 1,
        label: "ecs_dirk",
        nonpulsed_lights: [[2], [2], [2]],
        nonpulsed_lights_brightness: [["@s0"], [0], ["@s0"]],
        pre_illumination: [2, "@s0", "@n1:0"],
        protocol_averages: 1,
        protocol_repeats: 3,
        pulse_distance: [1500, 1500, 1500],
        pulse_length: [["a_d1"], ["a_d1"], ["a_d1"]],
        pulsed_lights: [[1], [1], [1]],
        pulsed_lights_brightness: [["a_b1"], ["a_b1"], ["a_b1"]],
        pulses: [100, 200, 100],
      },
      {
        detectors: [[1], [1], [1]],
        e_time: 1,
        label: "ftrans",
        nonpulsed_lights: [[2], [2], [2]],
        nonpulsed_lights_brightness: [["@s0"], [10000], ["@s0"]],
        pre_illumination: [2, "@s0", "@n1:1"],
        protocol_averages: 1,
        protocol_repeats: 1,
        pulse_distance: [4000, 4000, 4000],
        pulse_length: [[50], [50], [50]],
        pulsed_lights: [[3], [3], [3]],
        pulsed_lights_brightness: [800, 800, 800],
        pulses: [100, 100, 100],
      },
    ],
    protocol_id: 1547,
    set_repeats: "#l0",
    share: 1,
    v_arrays: [
      [0, 50, 100, 200, 400, 800, 0],
      [5000, 5000],
    ],
  },
];

describe("resolveNumericRef", () => {
  const vArrays = [
    [0, 50, 100, 200, 400, 800, 0],
    [5000, 5000],
  ];

  it("returns literal numbers unchanged", () => {
    expect(resolveNumericRef(1500, vArrays)).toBe(1500);
    expect(resolveNumericRef(0, vArrays)).toBe(0);
  });

  it("resolves #lN to the length of v_arrays[N]", () => {
    expect(resolveNumericRef("#l0", vArrays)).toBe(7);
    expect(resolveNumericRef("#l1", vArrays)).toBe(2);
  });

  it("resolves @nN:I to v_arrays[N][I]", () => {
    expect(resolveNumericRef("@n1:0", vArrays)).toBe(5000);
    expect(resolveNumericRef("@n0:4", vArrays)).toBe(400);
  });

  it("returns undefined for step-dependent @sN references (intensity, not duration)", () => {
    expect(resolveNumericRef("@s0", vArrays)).toBeUndefined();
  });

  it("returns undefined for unknown macros and out-of-range indices", () => {
    expect(resolveNumericRef("a_d1", vArrays)).toBeUndefined();
    expect(resolveNumericRef("@n9:0", vArrays)).toBeUndefined();
    expect(resolveNumericRef("#l9", vArrays)).toBeUndefined();
    expect(resolveNumericRef(null, vArrays)).toBeUndefined();
    expect(resolveNumericRef(NaN, vArrays)).toBeUndefined();
  });
});

describe("estimateProtocolDurationMs", () => {
  it("computes the expected duration for the real light-response-curve protocol", () => {
    expect(estimateProtocolDurationMs(LIGHT_RESPONSE_CURVE)).toBe(182_000);
  });

  it("accounts for set_repeats", () => {
    const oneRepeat = structuredClone(LIGHT_RESPONSE_CURVE);
    oneRepeat[0].set_repeats = 1 as unknown as string;
    // per-run total (autogain + ecs_dirk + ftrans)
    expect(estimateProtocolDurationMs(oneRepeat)).toBe(26_000);
  });

  it("multiplies a pulse train by protocol_repeats and protocol_averages", () => {
    const protocol = [
      {
        v_arrays: [],
        set_repeats: 1,
        _protocol_set_: [
          {
            // 10 pulses × 1000µs = 10ms train, no pre-illumination
            pulses: [10],
            pulse_distance: [1000],
            protocol_repeats: 4,
            protocol_averages: 2,
          },
        ],
      },
    ];
    // 10ms × 4 × 2
    expect(estimateProtocolDurationMs(protocol)).toBe(80);
  });

  it("adds pre-illumination duration to each block run", () => {
    const protocol = [
      {
        v_arrays: [[], [2000]],
        set_repeats: 1,
        _protocol_set_: [
          {
            pulses: [1],
            pulse_distance: [1000], // 1ms train
            pre_illumination: [2, "@s0", "@n1:0"], // 2000ms
            protocol_repeats: 1,
            protocol_averages: 1,
          },
        ],
      },
    ];
    expect(estimateProtocolDurationMs(protocol)).toBe(2001);
  });

  it("treats repeats/averages as at least 1 when missing", () => {
    const protocol = [
      {
        v_arrays: [],
        set_repeats: 1,
        _protocol_set_: [{ pulses: [5], pulse_distance: [1000] }], // 5ms, no repeats fields
      },
    ];
    expect(estimateProtocolDurationMs(protocol)).toBe(5);
  });

  it("accepts a single set object (not wrapped in an array)", () => {
    const single = LIGHT_RESPONSE_CURVE[0];
    expect(estimateProtocolDurationMs(single)).toBe(182_000);
  });

  it("returns 0 for unusable input rather than throwing", () => {
    expect(estimateProtocolDurationMs(undefined)).toBe(0);
    expect(estimateProtocolDurationMs(null)).toBe(0);
    expect(estimateProtocolDurationMs("not a protocol")).toBe(0);
    expect(estimateProtocolDurationMs([])).toBe(0);
    expect(estimateProtocolDurationMs([{}])).toBe(0);
    expect(estimateProtocolDurationMs([{ _protocol_set_: "garbage" }])).toBe(0);
  });

  it("sums multiple top-level protocol sets", () => {
    const a = {
      v_arrays: [],
      set_repeats: 1,
      _protocol_set_: [{ pulses: [1], pulse_distance: [1000] }],
    };
    const b = {
      v_arrays: [],
      set_repeats: 2,
      _protocol_set_: [{ pulses: [1], pulse_distance: [1000] }],
    };
    // 1ms + (1ms × 2)
    expect(estimateProtocolDurationMs([a, b])).toBe(3);
  });
});

describe("computeScanTimeoutMs", () => {
  it("applies safety factor and grace to the estimate", () => {
    // 182_000 × 2 + 10_000
    expect(computeScanTimeoutMs(LIGHT_RESPONSE_CURVE)).toBe(374_000);
  });

  it("floors at minMs so short/garbage protocols still get a sane timeout", () => {
    expect(computeScanTimeoutMs([{}])).toBe(SCAN_TIMEOUT_DEFAULTS.minMs);
    expect(computeScanTimeoutMs("garbage")).toBe(SCAN_TIMEOUT_DEFAULTS.minMs);
  });

  it("caps at maxMs so a pathological protocol cannot hang forever", () => {
    const huge = [
      {
        v_arrays: [],
        set_repeats: 100000,
        _protocol_set_: [{ pulses: [1000], pulse_distance: [100000] }],
      },
    ];
    expect(computeScanTimeoutMs(huge)).toBe(SCAN_TIMEOUT_DEFAULTS.maxMs);
  });

  it("honours custom options", () => {
    // estimate 0 → max(minMs, 0×3 + 5000)
    expect(
      computeScanTimeoutMs([{}], { safetyFactor: 3, graceMs: 5_000, minMs: 1_000, maxMs: 9_000 }),
    ).toBe(5_000);
  });

  it("never returns less than the supplied minMs floor", () => {
    expect(computeScanTimeoutMs(LIGHT_RESPONSE_CURVE, { minMs: 500_000, maxMs: 900_000 })).toBe(
      500_000,
    );
  });
});
