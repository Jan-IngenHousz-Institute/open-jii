import { describe, expect, it } from "vitest";

import {
  procedureSeriesNames,
  requiredProcedureSeriesNames,
  verificationSeriesNames,
  zCaptureProcedure,
} from "./iot-calibration-procedure.schema";

// The Ambit factory rig: a Kiprim DC source sweeping the lamp, two reference
// MiniPARs, the ADPD dark-fixture step.
const ambitFactoryProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM" },
    { role: "par_ref", handshake: "Par_REF" },
    { role: "emit_ref", handshake: "Emit_LED" },
  ],
  steps: [
    {
      kind: "operator",
      prompt: "Confirm MiniPAR placement, DC current limits, and optical alignment",
    },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: {
        instrument: "lamp",
        set: "current_a",
        values: [0.8, 2.4, 3.0, 4.0, 6.6, 0.0],
      },
      settleMs: 1000,
      read: [
        { instrument: "dut", command: "get_par", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "sweep",
      series: "led_sweep",
      stimulus: {
        instrument: "dut",
        set: "led_setting",
        values: [10, 20, 60, 90, 150, 250, 0],
      },
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

// The manual MiniPAR bench: no supply and no reference instrument. The operator
// sets up two light levels and darkness by hand and types the reading from a
// reference PAR sensor at each.
const manualMiniparProcedure = {
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

// The same MiniPAR bench automated: a DC supply steps the lamp through the six
// currents the bench uses, and a MicroPython photodiode replaces the operator's reading.
const automatedMiniparProcedure = {
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
  // One lamp current after the write, calibrated PAR beside the reference, then rest.
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

// MultispeQ color calibration: label setpoints (reference cards), a protocol
// read instead of a console command, operator-entered lot values.
const multispeqColorcalProcedure = {
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
        {
          operator: "Enter the card's lot reflectance value",
          as: "reflectance_ref",
          type: "number",
        },
      ],
    },
  ],
};

// MultispeQ compass: the operator acts while a long-timeout command runs.
const multispeqCompassProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "read",
      series: "compass",
      prompt: "Rotate the device in a figure 8 until calibration completes",
      read: [
        { instrument: "dut", command: "calibrate_compass", as: "result", timeoutMs: 30000 },
        { instrument: "dut", command: "print_magnetometer_bias", as: "bias" },
      ],
    },
  ],
};

// Ambit temperature two-point: stabilization sampling via repeat/interval.
const ambitTemperatureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "temp_cal",
      stimulus: {
        operator: "Place the device at reference temperature {value} C",
        values: [5, 40],
      },
      settleMs: 120_000,
      read: [
        { instrument: "dut", command: "temp", as: "temp_raw", repeat: 10, intervalMs: 3000 },
        { operator: "Enter the reference thermometer reading", as: "temp_ref", type: "number" },
      ],
    },
  ],
};

// Soil-moisture curve: compound object setpoints executed by the operator.
const soilMoistureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "vwc_curve",
      stimulus: {
        operator: "Insert the probe: {value.medium}, {value.condition}",
        values: [
          { medium: "sand", condition: "air_dry" },
          { medium: "sand", condition: "saturated" },
          { medium: "clay", condition: "air_dry" },
          { medium: "clay", condition: "saturated" },
        ],
      },
      read: [{ instrument: "dut", command: "read_vwc", as: "vwc_raw" }],
    },
  ],
};

const parSweepStep = ambitFactoryProcedure.steps[1];
const ledSweepStep = ambitFactoryProcedure.steps[2];
const manualSweepStep = manualMiniparProcedure.steps[0];
const colorcalSweepStep = multispeqColorcalProcedure.steps[0];

describe("zCaptureProcedure", () => {
  describe("real procedures parse", () => {
    it.each([
      ["Ambit factory (automated rig)", ambitFactoryProcedure],
      ["MiniPAR manual bench", manualMiniparProcedure],
      ["MiniPAR automated bench", automatedMiniparProcedure],
      ["MultispeQ color calibration", multispeqColorcalProcedure],
      ["MultispeQ compass", multispeqCompassProcedure],
      ["Ambit temperature two-point", ambitTemperatureProcedure],
      ["soil-moisture media curve", soilMoistureProcedure],
    ])("%s", (_name, procedure) => {
      const result = zCaptureProcedure.safeParse(procedure);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    });

    // A label setpoint is something an operator does with their hands; an
    // instrument cannot be told "white_a", and the bench would abort on it.
    it("refuses a label setpoint aimed at an instrument", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "cards",
            stimulus: { instrument: "lamp", set: "current_a", values: ["white_a"] },
            read: [{ instrument: "dut", command: "get_par", as: "reading" }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("derives the series names the run payload may carry", () => {
      const parsed = zCaptureProcedure.parse(ambitFactoryProcedure);
      expect(procedureSeriesNames(parsed)).toEqual(["par_sweep", "led_sweep", "adpd_baseline"]);
    });

    // The supply is set up before the sweep; those steps read nothing.
    it("produces no series from set steps", () => {
      const parsed = zCaptureProcedure.parse(automatedMiniparProcedure);
      expect(procedureSeriesNames(parsed)).toEqual(["par_sweep"]);
      expect(requiredProcedureSeriesNames(parsed)).toEqual(["par_sweep"]);
    });

    // The verify phase runs after the write, so its series never reach the script.
    it("keeps the verify phase's series apart from the capture series", () => {
      const parsed = zCaptureProcedure.parse(automatedMiniparProcedure);
      expect(verificationSeriesNames(parsed)).toEqual(["par_check"]);
      expect(procedureSeriesNames(parsed)).toEqual(["par_sweep"]);
      expect(verificationSeriesNames(zCaptureProcedure.parse(manualMiniparProcedure))).toEqual([]);
    });

    // A bench without the Emit_LED MiniPAR and without the dark fixture still
    // produces a useful PAR calibration, so only its series is required.
    it("excludes optional steps from the required series", () => {
      const parsed = zCaptureProcedure.parse({
        ...ambitFactoryProcedure,
        steps: ambitFactoryProcedure.steps.map((step) =>
          step.kind === "sweep" && step.series === "led_sweep"
            ? { ...step, optional: true }
            : step.kind === "read" && step.series === "adpd_baseline"
              ? { ...step, optional: true }
              : step,
        ),
      });

      expect(procedureSeriesNames(parsed)).toEqual(["par_sweep", "led_sweep", "adpd_baseline"]);
      expect(requiredProcedureSeriesNames(parsed)).toEqual(["par_sweep"]);
    });
  });

  describe("cross-references", () => {
    it("rejects a stimulus targeting an undeclared instrument", () => {
      const result = zCaptureProcedure.safeParse({
        ...ambitFactoryProcedure,
        instruments: ambitFactoryProcedure.instruments.filter((i) => i.role !== "lamp"),
      });
      expect(result.success).toBe(false);
    });

    it("rejects a set step aimed at an undeclared instrument", () => {
      const result = zCaptureProcedure.safeParse({
        ...automatedMiniparProcedure,
        steps: [
          { kind: "set", instrument: "supply", set: "voltage_v", value: 25 },
          ...automatedMiniparProcedure.steps,
        ],
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "instrument",
      ]);
    });

    it("rejects a verify step reading an undeclared instrument", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        verify: [
          {
            kind: "read",
            series: "par_check",
            read: [{ instrument: "meter", command: "par", as: "par_ref" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "verify",
        0,
        "read",
        0,
        "instrument",
      ]);
    });

    it("rejects an empty verify phase", () => {
      const result = zCaptureProcedure.safeParse({ ...manualMiniparProcedure, verify: [] });
      expect(result.success).toBe(false);
    });

    it("rejects a set step without a numeric value", () => {
      const result = zCaptureProcedure.safeParse({
        ...automatedMiniparProcedure,
        steps: [{ kind: "set", instrument: "lamp", set: "voltage_v", value: "25" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects a read from an undeclared instrument", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }],
        steps: [
          {
            ...manualSweepStep,
            read: [{ instrument: "par_ref", command: "par", as: "par_ref" }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects a rig without the device under test", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "lamp", handshake: "KIPRIM" }],
        steps: manualMiniparProcedure.steps,
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate instrument roles", () => {
      const result = zCaptureProcedure.safeParse({
        ...ambitFactoryProcedure,
        instruments: [...ambitFactoryProcedure.instruments, { role: "lamp", handshake: "OTHER" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects an auxiliary instrument claiming the dut role", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        instruments: [{ role: "dut", handshake: "KIPRIM" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("series and columns", () => {
    it("rejects two steps producing the same series", () => {
      const result = zCaptureProcedure.safeParse({
        ...ambitFactoryProcedure,
        steps: [parSweepStep, { ...ledSweepStep, series: "par_sweep" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate column names within a step", () => {
      const result = zCaptureProcedure.safeParse({
        ...ambitFactoryProcedure,
        steps: [
          {
            ...parSweepStep,
            read: [
              { instrument: "dut", command: "get_par", as: "par_raw" },
              { instrument: "par_ref", command: "par", as: "par_raw" },
            ],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects the reserved stimulus column in a sweep read", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        steps: [
          {
            ...manualSweepStep,
            read: [{ instrument: "dut", command: "get_par", as: "stimulus" }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects series names that are not identifiers", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        steps: [{ ...manualSweepStep, series: "Par Sweep" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reads", () => {
    it("rejects an instrument read with both command and protocol", () => {
      const result = zCaptureProcedure.safeParse({
        ...multispeqColorcalProcedure,
        steps: [
          {
            ...colorcalSweepStep,
            read: [
              { instrument: "dut", command: "get_par", protocol: "detector_scan", as: "channels" },
            ],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects a read naming a protocol the procedure does not declare", () => {
      const result = zCaptureProcedure.safeParse({
        ...multispeqColorcalProcedure,
        protocols: { other_scan: { pulses: [20] } },
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues[0].path).toEqual([
        "steps",
        0,
        "read",
        0,
        "protocol",
      ]);
    });

    // A bench reference answers named readings only, so a protocol aimed at one
    // would abort the session at the bench rather than fail at publish time.
    it("rejects a protocol read aimed at a bench instrument", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }, { role: "par_ref", handshake: "Par_REF" }],
        protocols: { detector_scan: { pulses: [20] } },
        steps: [
          {
            kind: "read",
            series: "colorcal",
            read: [{ instrument: "par_ref", protocol: "detector_scan", as: "channels" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.success ? "" : result.error.issues[0].message).toContain(
        "can run a measurement protocol",
      );
    });

    it("rejects a protocols map larger than the byte cap", () => {
      const result = zCaptureProcedure.safeParse({
        ...multispeqColorcalProcedure,
        protocols: { detector_scan: { pulses: Array.from({ length: 40_000 }, () => 20) } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects a protocol keyed by something other than an identifier", () => {
      const result = zCaptureProcedure.safeParse({
        ...multispeqColorcalProcedure,
        protocols: { "Detector Scan": { pulses: [20] } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects an instrument read with neither command nor protocol", () => {
      const result = zCaptureProcedure.safeParse({
        ...multispeqColorcalProcedure,
        steps: [{ ...colorcalSweepStep, read: [{ instrument: "dut", as: "channels" }] }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects an operator read without a type", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        steps: [{ ...manualSweepStep, read: [{ operator: "Enter the reading", as: "par_ref" }] }],
      });
      expect(result.success).toBe(false);
    });

    // A bench is often told the level and asked for the trace in one command,
    // so a sweep's reads carry the setpoint the same way a prompt does.
    it("accepts a setpoint placeholder in a sweep read's command", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
            read: [{ instrument: "dut", command: "arrun2,{value},1", as: "par_raw" }],
          },
        ],
      });
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    });

    // A step prompt is read by the operator, so an unresolved placeholder is
    // nonsense on a screen rather than on a wire, and is refused the same way.
    it.each([
      ["an operator step's instruction", { kind: "operator", prompt: "Set the lamp to {value}" }],
      [
        "a read step's instruction",
        {
          kind: "read",
          series: "par_check",
          prompt: "Hold the sensor at {value}",
          read: [{ instrument: "dut", command: "par", as: "par" }],
        },
      ],
    ])("rejects a setpoint placeholder in %s", (_name, step) => {
      const result = zCaptureProcedure.safeParse({ instruments: [{ role: "dut" }], steps: [step] });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "prompt",
      ]);
    });

    // An operator read's prompt is the other place a placeholder can be published.
    it("rejects a setpoint placeholder in a read step's operator prompt", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_check",
            read: [
              { instrument: "dut", command: "par", as: "par" },
              { operator: "Enter the meter reading at {value} A", as: "par_ref", type: "number" },
            ],
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "read",
        1,
        "operator",
      ]);
    });

    it("rejects a keyed placeholder in an operator prompt a sweep drives by instrument", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 0] },
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              { operator: "Enter the reading at {value.level}", as: "par_ref", type: "number" },
            ],
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "read",
        1,
        "operator",
      ]);
    });

    // Outside a sweep there is no setpoint, so the device would be sent the braces themselves.
    it("rejects a setpoint placeholder in a read step's command", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_check",
            read: [{ instrument: "dut", command: "arrun2,{value},1", as: "par_raw" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "read",
        0,
        "command",
      ]);
    });

    it("rejects a read step naming a protocol that interpolates, while a sweep may name it", () => {
      const procedure = {
        instruments: [{ role: "dut" }],
        protocols: { detector_scan: { pulses: ["{value}"], detectors: [[1, 2]] } },
        steps: [
          {
            kind: "sweep",
            series: "colorcal",
            stimulus: { operator: "Clamp onto reference card {value}", values: ["white_a"] },
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };
      const asReadStep = {
        ...procedure,
        steps: [
          {
            kind: "read",
            series: "colorcal",
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };

      expect(zCaptureProcedure.safeParse(procedure).success).toBe(true);
      const result = zCaptureProcedure.safeParse(asReadStep);
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "read",
        0,
        "protocol",
      ]);
    });

    // An instrument steps through plain numbers, so a key has nothing to pick out.
    it("rejects a keyed placeholder in a sweep driven by an instrument", () => {
      const result = zCaptureProcedure.safeParse({
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
            read: [{ instrument: "dut", command: "arrun2,{value.level},1", as: "par_raw" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
        "steps",
        0,
        "read",
        0,
        "command",
      ]);
    });

    it("rejects an empty sweep", () => {
      const result = zCaptureProcedure.safeParse({
        ...manualMiniparProcedure,
        steps: [
          {
            ...manualSweepStep,
            stimulus: { operator: "Set the lamp to {value}", values: [] },
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
