import { describe, expect, it } from "vitest";

import { requiredSeriesNames } from "./types";
import type { CaptureProcedure } from "./types";

/**
 * These fixtures are the same procedures the contract's own schema spec parses.
 * This package cannot import `@repo/api`, so its procedure types are a hand-kept
 * mirror; if the contract's shape moves, these stop compiling here before a
 * wizard meets a procedure it cannot execute.
 */
const AMBIT_FACTORY: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM" },
    { role: "par_ref", handshake: "Par_REF" },
    { role: "emit_ref", handshake: "Emit_LED" },
  ],
  steps: [
    { kind: "operator", prompt: "Confirm MiniPAR placement, DC current limits, alignment" },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4, 3.0, 4.0, 6.6, 0.0] },
      settleMs: 1000,
      read: [
        { instrument: "dut", command: "get_par", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "sweep",
      series: "led_sweep",
      stimulus: { instrument: "dut", set: "led_setting", values: [10, 20, 60, 90, 150, 250, 0] },
      read: [{ instrument: "emit_ref", command: "par", as: "par_over_led" }],
    },
    { kind: "operator", prompt: "Install the dark fixture", confirm: "DARK" },
    {
      kind: "read",
      series: "adpd_baseline",
      read: [{ instrument: "dut", command: "baseline,0", as: "channels" }],
    },
  ],
};

const MANUAL_MINIPAR: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: {
        operator: "Set up {value}, then wait for both readings to settle before continuing.",
        values: ["a first light level", "a second light level", "darkness"],
      },
      settleMs: 1000,
      read: [
        { instrument: "dut", command: "par_raw", as: "par_raw" },
        {
          operator: "Enter the PAR value shown by the reference sensor",
          as: "par_ref",
          type: "number",
        },
      ],
    },
  ],
};

/** The same procedure with the operator replaced by a supply and a reference. */
const AUTOMATED_MINIPAR: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM" },
    { role: "par_ref", handshake: "raw REPL" },
  ],
  steps: [
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
    { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.2, 0.4, 0.8, 1.0, 1.6, 0] },
      settleMs: 1000,
      read: [
        { instrument: "dut", command: "par_raw", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
  ],
  verify: [
    { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
    { kind: "settle", ms: 1000 },
    {
      kind: "read",
      series: "par_check",
      read: [
        { instrument: "dut", command: "par", as: "par" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
  ],
};

const MULTISPEQ_COLORCAL: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  protocols: {
    detector_scan: { pulses: [20], pulse_distance: [10000], detectors: [[1, 2, 3, 4]] },
  },
  steps: [
    {
      kind: "sweep",
      series: "colorcal",
      stimulus: {
        operator: "Clamp onto reference card {value}",
        values: ["white_a", "grey_18", "black_c"],
      },
      read: [
        { instrument: "dut", protocol: "detector_scan", as: "channels" },
        { operator: "Enter the card's lot reflectance", as: "reflectance_ref", type: "number" },
      ],
    },
  ],
};

const AMBIT_TEMPERATURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "temp_cal",
      stimulus: { operator: "Place the device at {value} C", values: [5, 40] },
      settleMs: 120_000,
      read: [
        { instrument: "dut", command: "temp", as: "temp_raw", repeat: 10, intervalMs: 3000 },
        { operator: "Enter the reference thermometer reading", as: "temp_ref", type: "number" },
      ],
    },
  ],
};

const SOIL_MOISTURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "vwc_curve",
      stimulus: {
        operator: "Insert the probe: {value.medium}, {value.condition}",
        values: [
          { medium: "sand", condition: "air_dry" },
          { medium: "clay", condition: "saturated" },
        ],
      },
      read: [{ instrument: "dut", command: "read_vwc", as: "vwc_raw" }],
    },
  ],
};

describe("procedure types", () => {
  it("expresses every rig shape the contract accepts", () => {
    const procedures = [
      AMBIT_FACTORY,
      MANUAL_MINIPAR,
      AUTOMATED_MINIPAR,
      MULTISPEQ_COLORCAL,
      AMBIT_TEMPERATURE,
      SOIL_MOISTURE,
    ];

    expect(procedures.every((procedure) => procedure.steps.length > 0)).toBe(true);
  });

  describe("requiredSeriesNames", () => {
    it("lists every series a full run must produce", () => {
      expect(requiredSeriesNames(AMBIT_FACTORY)).toEqual([
        "par_sweep",
        "led_sweep",
        "adpd_baseline",
      ]);
    });

    // The payload check that guards a run accepts a bench missing an optional
    // instrument, so those series must not be demanded.
    it("excludes optional steps", () => {
      const partial: CaptureProcedure = {
        ...AMBIT_FACTORY,
        steps: AMBIT_FACTORY.steps.map((step) =>
          step.kind === "sweep" && step.series === "led_sweep" ? { ...step, optional: true } : step,
        ),
      };

      expect(requiredSeriesNames(partial)).toEqual(["par_sweep", "adpd_baseline"]);
    });

    it("ignores operator, settle and set steps, which produce nothing", () => {
      expect(requiredSeriesNames(MANUAL_MINIPAR)).toEqual(["par_sweep"]);
      expect(requiredSeriesNames(AUTOMATED_MINIPAR)).toEqual(["par_sweep"]);
    });

    // Manual and automated MiniPAR produce the same payload, so one script
    // and one output schema serve both.
    it("demands the same series from the manual and automated MiniPAR rigs", () => {
      expect(requiredSeriesNames(AUTOMATED_MINIPAR)).toEqual(requiredSeriesNames(MANUAL_MINIPAR));
    });

    // The verify phase runs after the write; its series are never part of the run payload.
    it("leaves the verify phase out of the required series", () => {
      expect(requiredSeriesNames(AUTOMATED_MINIPAR)).not.toContain("par_check");
    });
  });
});
