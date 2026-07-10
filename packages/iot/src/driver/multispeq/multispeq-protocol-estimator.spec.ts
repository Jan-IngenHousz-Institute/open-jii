import { describe, it, expect } from "vitest";

import {
  computeScanTimeoutMs,
  estimateProtocolDurationMs,
  resolveCommandTimeoutMs,
  resolveNumericRef,
  resolveProtocolVariables,
  protocolRequiresInteraction,
  SCAN_TIMEOUT_DEFAULTS,
  MEASUREMENT_TIMEOUT_FLOOR_MS,
} from "./multispeq-protocol-estimator";

/**
 * Real "light response curve" protocol (protocol_id 1547, OJD-1565). Expected
 * 164_000 ms = autogain 3_000 (do_once) + ecs_dirk (600+5000)×3×7 = 117_600 +
 * ftrans (1200+5000)×1×7 = 43_400.
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

  it("does not treat a non-array v_arrays entry as a length (#lN)", () => {
    // A malformed scalar must not resolve to its string length (would inflate set_repeats).
    expect(resolveNumericRef("#l0", ["abc"] as unknown as number[][])).toBeUndefined();
    expect(resolveNumericRef("#l0", [[1, 2, 3]])).toBe(3);
  });
});

describe("resolveProtocolVariables", () => {
  it("indexes numeric cells as @nN:I plus the occurrence-stepped @sN", () => {
    const vArrays = [
      [10, 20],
      [3000, 6000],
    ];
    expect(resolveProtocolVariables(vArrays, 0)).toEqual({
      "@n0:0": 10,
      "@n0:1": 20,
      "@n1:0": 3000,
      "@n1:1": 6000,
      "@s0": 10,
      "@s1": 3000,
    });
    expect(resolveProtocolVariables(vArrays, 1)).toMatchObject({ "@s0": 20, "@s1": 6000 });
  });

  it("leaves @sN unset when the indexed slot is a non-numeric placeholder", () => {
    expect(resolveProtocolVariables([["p_light", 2500]], 0)).toEqual({ "@n0:1": 2500 });
    expect(resolveProtocolVariables([["p_light", 2500]], 1)).toEqual({
      "@n0:1": 2500,
      "@s0": 2500,
    });
  });

  it("clamps out-of-range occurrences to the last numeric value", () => {
    expect(resolveProtocolVariables([[10, 20]], 5)).toMatchObject({ "@s0": 20 });
  });

  it("returns empty for missing or empty v_arrays", () => {
    expect(resolveProtocolVariables([])).toEqual({});
    expect(resolveProtocolVariables([[]])).toEqual({});
  });
});

describe("estimateProtocolDurationMs", () => {
  it("computes the expected duration for the real light-response-curve protocol", () => {
    expect(estimateProtocolDurationMs(LIGHT_RESPONSE_CURVE)).toBe(164_000);
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

  it("counts a standalone pre_illumination block that has no pulses", () => {
    // Documented construct: a pulseless block that only pre-illuminates the
    // sample (help.photosynq.com pre-illumination example is a 10 min soak).
    expect(
      estimateProtocolDurationMs([
        { _protocol_set_: [{ label: "Pre-Illumination", pre_illumination: [2, 200, 600_000] }] },
      ]),
    ).toBe(600_000);
  });

  it("multiplies a pulseless pre_illumination block by protocol_repeats", () => {
    expect(
      estimateProtocolDurationMs([
        { _protocol_set_: [{ pre_illumination: [2, 200, 10_000], protocol_repeats: 3 }] },
      ]),
    ).toBe(30_000);
  });

  it("sums the multi-LED pre_illumination form", () => {
    expect(
      estimateProtocolDurationMs([
        {
          _protocol_set_: [
            {
              pre_illumination: [
                [2, 200, 600_000],
                [3, 100, 300_000],
              ],
            },
          ],
        },
      ]),
    ).toBe(900_000);
  });

  it("sums a ramped pre_illumination duration array", () => {
    expect(
      estimateProtocolDurationMs([
        { _protocol_set_: [{ pre_illumination: [2, 200, [1_000, 2_000, 3_000]] }] },
      ]),
    ).toBe(6_000);
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
    expect(estimateProtocolDurationMs(single)).toBe(164_000);
  });

  it("counts protocols_delay on setup-only and delay-only blocks", () => {
    // autogain block with a 2s delay: SETUP_BLOCK_MS (3000) + 2000
    expect(
      estimateProtocolDurationMs([{ _protocol_set_: [{ autogain: [[1]], protocols_delay: 2 }] }]),
    ).toBe(5000);
    // delay-only block (no pulses, no autogain): just the 2s delay
    expect(estimateProtocolDurationMs([{ _protocol_set_: [{ protocols_delay: 2 }] }])).toBe(2000);
  });

  it("multiplies a pulse train by the per-phase detector channel count", () => {
    const protocol = [
      {
        v_arrays: [],
        set_repeats: 1,
        // 10 pulses × 2 detectors × 1000µs = 20ms (each channel fires its own pulse)
        _protocol_set_: [{ pulses: [10], pulse_distance: [1000], detectors: [[3, 4]] }],
      },
    ];
    expect(estimateProtocolDurationMs(protocol)).toBe(20);
  });

  it("resolves @sN pulse counts per set-repeat occurrence", () => {
    const protocol = [
      {
        // pulses step 20 → 100 across the two set repeats
        v_arrays: [[20, 100]],
        set_repeats: 2,
        _protocol_set_: [{ pulses: ["@s0"], pulse_distance: [1000] }],
      },
    ];
    // occ0: 20 × 1000µs = 20ms, occ1: 100 × 1000µs = 100ms → 120ms
    expect(estimateProtocolDurationMs(protocol)).toBe(120);
  });

  it("clamps @sN to the last value when set_repeats runs past the step array", () => {
    const protocol = [
      {
        // 3 set repeats but only 2 step values → the 3rd clamps to the last (100)
        v_arrays: [[20, 100]],
        set_repeats: 3,
        _protocol_set_: [{ pulses: ["@s0"], pulse_distance: [1000] }],
      },
    ];
    // occ0: 20ms, occ1: 100ms, occ2 (clamped): 100ms → 220ms
    expect(estimateProtocolDurationMs(protocol)).toBe(220);
  });

  it("adds protocols_delay (seconds) as a wall-clock wait", () => {
    const protocol = [
      {
        v_arrays: [],
        set_repeats: 1,
        // 1ms train + 2000ms protocols_delay
        _protocol_set_: [{ pulses: [1], pulse_distance: [1000], protocols_delay: 2 }],
      },
    ];
    expect(estimateProtocolDurationMs(protocol)).toBe(2001);
  });

  it("counts a do_once block only once across set_repeats", () => {
    const protocol = [
      {
        v_arrays: [],
        set_repeats: 3,
        _protocol_set_: [
          { autogain: [[1]], do_once: 1, label: "autogain" }, // 3000ms, once
          { pulses: [10], pulse_distance: [1000] }, // 10ms × 3 repeats
        ],
      },
    ];
    // 3000 (once) + 10 × 3 = 3030
    expect(estimateProtocolDurationMs(protocol)).toBe(3030);
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
    // 164_000 × 2 + 10_000
    expect(computeScanTimeoutMs(LIGHT_RESPONSE_CURVE)).toBe(338_000);
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

/**
 * Real interactive protocol (OJD-1643). The pulse train estimates to ~20s, but
 * the device pauses on the clamp open/close gates for as long as the user
 * takes, so the 60s base would cut it off mid-measurement.
 */
const INTERACTIVE_PROTOCOL = [
  {
    _protocol_set_: [
      { label: "no_leaf_baseline", par_led_start_on_open: 2, energy_save_timeout: 300000 },
      {
        label: "DIRK_ECS",
        par_led_start_on_close: 2,
        protocols_delay: 10,
        pulses: [100, 100, 20],
        pulse_distance: [1500, 1500, 1500],
        detectors: [[3], [3], [3]],
      },
    ],
  },
];

describe("resolveCommandTimeoutMs", () => {
  it("keeps the base timeout for string console commands", () => {
    expect(resolveCommandTimeoutMs("1007+", 5_000)).toBe(5_000);
  });

  it("floors a measurement protocol at the 2 min measurement floor, not the base", () => {
    // The interactive protocol's pulse estimate is well under the floor; it must
    // still get the full 2 min so the open/close pause is not cut off.
    expect(resolveCommandTimeoutMs(INTERACTIVE_PROTOCOL, 60_000)).toBe(
      MEASUREMENT_TIMEOUT_FLOOR_MS,
    );
    expect(MEASUREMENT_TIMEOUT_FLOOR_MS).toBe(120_000);
  });

  it("lets a long protocol grow past the floor via its estimate", () => {
    // 164_000 × 2 + 10_000 = 338_000 > floor.
    expect(resolveCommandTimeoutMs(LIGHT_RESPONSE_CURVE, 60_000)).toBe(338_000);
  });
});

describe("protocolRequiresInteraction", () => {
  it("detects open/close clamp gates anywhere in the protocol", () => {
    expect(protocolRequiresInteraction(INTERACTIVE_PROTOCOL)).toBe(true);
    expect(protocolRequiresInteraction([{ _protocol_set_: [{ par_led_start_on_open: 2 }] }])).toBe(
      true,
    );
    expect(protocolRequiresInteraction([{ _protocol_set_: [{ par_led_start_on_close: 1 }] }])).toBe(
      true,
    );
  });

  it("returns false for protocols without a gate, and for non-protocols", () => {
    expect(protocolRequiresInteraction(LIGHT_RESPONSE_CURVE)).toBe(false);
    expect(protocolRequiresInteraction([{ _protocol_set_: [{ pulses: [10] }] }])).toBe(false);
    expect(protocolRequiresInteraction("garbage")).toBe(false);
    expect(protocolRequiresInteraction([])).toBe(false);
  });
});
