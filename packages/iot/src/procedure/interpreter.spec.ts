import { describe, expect, it, vi } from "vitest";

import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import { KIPRIM_COMMANDS } from "../instrument/kiprim/commands";
import { KiprimDcSource } from "../instrument/kiprim/instrument";
import { MicroPythonParReference } from "../instrument/micropython-par/instrument";
import {
  bindBenchInstrument,
  runCaptureProcedure,
  runVerificationProcedure,
  shutdownRig,
} from "./interpreter";
import type { ProcedureContext, RigBinding } from "./interpreter";
import {
  ProcedureAborted,
  ProcedureDeclined,
  ProcedureRigError,
  ProcedureStopped,
} from "./operator";
import type { OperatorPort, ProcedureProgress } from "./operator";
import type { CaptureProcedure } from "./types";

/** The Ambit factory rig, as the platform-provided definition declares it. */
const AMBIT_PROCEDURE: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM" },
    { role: "par_ref", handshake: "Par_REF" },
    { role: "emit_ref", handshake: "Emit_LED" },
  ],
  steps: [
    { kind: "operator", prompt: "Confirm MiniPAR placement and optical alignment" },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4, 0.0] },
      settleMs: 1000,
      read: [
        { instrument: "dut", command: "get_par", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "sweep",
      series: "led_sweep",
      optional: true,
      stimulus: { instrument: "dut", set: "led_setting", values: [10, 0] },
      read: [{ instrument: "emit_ref", command: "par", as: "par_over_led" }],
    },
    { kind: "operator", prompt: "Install the dark fixture", confirm: "DARK" },
    {
      kind: "read",
      series: "adpd_baseline",
      optional: true,
      read: [{ instrument: "dut", command: "baseline,0", as: "channels" }],
    },
  ],
};

function reader(replies: Record<string, unknown>): RigBinding {
  return {
    read: {
      execute: vi.fn((command: string | object) =>
        Promise.resolve({
          success: true,
          data: typeof command === "string" ? replies[command] : undefined,
        }),
      ),
    },
  };
}

function setpointTarget(): RigBinding & { applied: [string, number][] } {
  const applied: [string, number][] = [];
  return {
    applied,
    setpoint: {
      applySetpoint: vi.fn((name: string, value: number) => {
        applied.push([name, value]);
        return Promise.resolve();
      }),
    },
  };
}

function operator(overrides?: Partial<OperatorPort>): OperatorPort {
  return {
    acknowledge: vi.fn(() => Promise.resolve(true)),
    readValue: vi.fn(() => Promise.resolve(0)),
    confirmReading: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

/** A full rig: dut reads and takes setpoints, lamp drives, references read. */
function fullRig() {
  const lamp = setpointTarget();
  const dutSetpoint = setpointTarget();
  return {
    lamp,
    dutSetpoint,
    rig: {
      dut: {
        ...reader({ get_par: 148.2, "baseline,0": [1021, 987, 1103, 954, 1200, 1015] }),
        setpoint: dutSetpoint.setpoint,
      },
      lamp,
      par_ref: reader({ par: 176.4 }),
      emit_ref: reader({ par: 41.2 }),
    } satisfies Record<string, RigBinding>,
  };
}

function context(overrides: Partial<ProcedureContext> = {}): ProcedureContext {
  return {
    rig: {},
    operator: operator(),
    sleep: () => Promise.resolve(),
    ...overrides,
  };
}

/** The abort a run ends in, typed without a cast so its reason and partial payload can be inspected. */
async function abortOf(run: Promise<unknown>): Promise<ProcedureAborted> {
  const outcome: unknown = await run.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(outcome instanceof ProcedureAborted)) {
    throw new Error(`Expected the run to abort, got ${String(outcome)}`);
  }
  return outcome;
}

describe("runCaptureProcedure", () => {
  it("captures every series a full rig can produce", async () => {
    const { rig, lamp } = fullRig();

    const result = await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig }));

    expect(Object.keys(result.payload)).toEqual(["par_sweep", "led_sweep", "adpd_baseline"]);
    expect(result.skipped).toEqual([]);
    // The lamp walked the declared sweep and ended back at zero.
    expect(lamp.applied).toEqual([
      ["current_a", 0.8],
      ["current_a", 2.4],
      ["current_a", 0],
    ]);
  });

  it("writes one row per setpoint, carrying the setpoint itself", async () => {
    const { rig } = fullRig();

    const result = await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig }));

    expect(result.payload.par_sweep).toEqual([
      { stimulus: 0.8, par_raw: 148.2, par_ref: 176.4 },
      { stimulus: 2.4, par_raw: 148.2, par_ref: 176.4 },
      { stimulus: 0, par_raw: 148.2, par_ref: 176.4 },
    ]);
  });

  it("settles between applying a setpoint and reading it", async () => {
    const { rig } = fullRig();
    const sleep = vi.fn((_ms: number) => Promise.resolve());

    await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig, sleep }));

    expect(sleep).toHaveBeenCalledWith(1000);
  });

  // A bench without the Emit_LED reference and without the dark fixture still
  // produces a usable PAR calibration.
  describe("partial rig", () => {
    it("skips optional steps whose instrument is absent", async () => {
      const { rig } = fullRig();
      const partial = { dut: rig.dut, lamp: rig.lamp, par_ref: rig.par_ref };

      const result = await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig: partial }));

      expect(Object.keys(result.payload)).toEqual(["par_sweep", "adpd_baseline"]);
      expect(result.skipped).toEqual([
        { series: "led_sweep", reason: 'instrument "emit_ref" is not connected' },
      ]);
    });

    it("skips an optional read step whose instrument is absent", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }, { role: "par_ref", handshake: "Par_REF" }],
        steps: [
          {
            kind: "read",
            series: "reference_check",
            optional: true,
            read: [{ instrument: "par_ref", command: "par", as: "par_ref" }],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ par_raw: 1 }) } }),
      );

      expect(result.payload).toEqual({});
      expect(result.skipped).toEqual([
        { series: "reference_check", reason: 'instrument "par_ref" is not connected' },
      ]);
    });

    it("skips an optional sweep whose stimulus instrument is absent", async () => {
      const { rig } = fullRig();
      const withoutLamp = { dut: rig.dut, par_ref: rig.par_ref, emit_ref: rig.emit_ref };
      const procedure: CaptureProcedure = {
        ...AMBIT_PROCEDURE,
        steps: AMBIT_PROCEDURE.steps.map((step) =>
          step.kind === "sweep" && step.series === "par_sweep" ? { ...step, optional: true } : step,
        ),
      };

      const result = await runCaptureProcedure(procedure, context({ rig: withoutLamp }));

      expect(result.skipped).toContainEqual({
        series: "par_sweep",
        reason: 'instrument "lamp" is not connected',
      });
      expect(result.payload.par_sweep).toBeUndefined();
    });

    it("aborts when a required step's instrument is absent", async () => {
      const { rig } = fullRig();
      const withoutReference = { dut: rig.dut, lamp: rig.lamp };

      const aborted = await abortOf(
        runCaptureProcedure(AMBIT_PROCEDURE, context({ rig: withoutReference })),
      );

      expect(aborted.reason).toBeInstanceOf(ProcedureRigError);
    });

    // A bench session is long and its series are independent: a fault during
    // the LED sweep must not discard a PAR sweep that already succeeded.
    it("keeps the series it already captured when a later step fails", async () => {
      const { rig } = fullRig();
      const dyingReference: RigBinding = {
        read: {
          execute: vi.fn(() =>
            Promise.resolve({ success: false, error: new Error("reference unplugged") }),
          ),
        },
      };

      const aborted = await abortOf(
        runCaptureProcedure(
          AMBIT_PROCEDURE,
          context({ rig: { ...rig, emit_ref: dyingReference } }),
        ),
      );

      expect(aborted.reason.message).toMatch(/reference unplugged/);
      // The completed sweep survives, so the operator can still submit it.
      expect(aborted.partial.payload.par_sweep).toHaveLength(3);
      expect(aborted.partial.payload.led_sweep).toBeUndefined();
    });

    it("reports each skip so the run record can say what was not attempted", async () => {
      const { rig } = fullRig();
      const events: ProcedureProgress[] = [];

      await runCaptureProcedure(
        AMBIT_PROCEDURE,
        context({
          rig: { dut: rig.dut, lamp: rig.lamp, par_ref: rig.par_ref },
          onProgress: (event) => events.push(event),
        }),
      );

      expect(events).toContainEqual({
        kind: "skipped",
        series: "led_sweep",
        reason: 'instrument "emit_ref" is not connected',
      });
    });

    // A sweep's `series` event only arrives once the whole series is in, which is minutes
    // after the first point. Reporting each point as it is kept is what lets the bench draw
    // the curve while it is still set up to take another one.
    it("reports each point as it is kept, before the series is finished", async () => {
      const { rig } = fullRig();
      const events: ProcedureProgress[] = [];

      await runCaptureProcedure(
        AMBIT_PROCEDURE,
        context({ rig, onProgress: (event) => events.push(event) }),
      );

      const rows = events.filter((event) => event.kind === "row");
      const parRows = rows.filter((event) => event.series === "par_sweep");
      expect(parRows).toHaveLength(3);
      expect(parRows[0]).toMatchObject({ kind: "row", series: "par_sweep", index: 0 });

      // Every point of a series is reported before that series is declared complete.
      const firstRow = events.findIndex((event) => event.kind === "row");
      const firstSeries = events.findIndex((event) => event.kind === "series");
      expect(firstRow).toBeLessThan(firstSeries);
    });
  });

  describe("retaking a reading", () => {
    /** A probe whose reading changes each time it is read, so a retake is visible. */
    function drifting(values: number[]): RigBinding {
      let call = 0;
      return {
        read: {
          execute: vi.fn(() =>
            Promise.resolve({ success: true, data: values[Math.min(call++, values.length - 1)] }),
          ),
        },
      };
    }

    const MANUAL: CaptureProcedure = {
      instruments: [{ role: "dut" }],
      steps: [
        {
          kind: "sweep",
          series: "spec_sweep",
          stimulus: { operator: "Cover the sensor with {value}", values: ["no filter"] },
          read: [{ instrument: "dut", command: "spec", as: "spec" }],
        },
      ],
    };

    // The bench tools this replaces are a REPL: a filter slips, the operator reads again.
    // A fixed sweep that cannot be corrected wastes the whole session over one point.
    it("takes the point again and keeps the second reading", async () => {
      const port = operator({
        confirmReading: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
      });

      const result = await runCaptureProcedure(
        MANUAL,
        context({ rig: { dut: drifting([11, 22]) }, operator: port }),
      );

      expect(result.payload.spec_sweep).toEqual([{ stimulus: "no filter", spec: 22 }]);
    });

    // The discarded reading is evidence: a reviewer should see a point was taken twice.
    it("keeps the reading it replaced beside the series", async () => {
      const port = operator({
        confirmReading: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
      });

      const result = await runCaptureProcedure(
        MANUAL,
        context({ rig: { dut: drifting([11, 22]) }, operator: port }),
      );

      expect(result.payload.spec_sweep_retaken).toEqual([{ stimulus: "no filter", spec: 11 }]);
    });

    // Repositioning is usually why a reading was wrong, so the operator is asked to set the
    // point up again rather than the rig silently re-reading the same arrangement.
    it("asks the operator to set the point up again", async () => {
      const port = operator({
        confirmReading: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
      });

      await runCaptureProcedure(
        MANUAL,
        context({ rig: { dut: drifting([11, 22]) }, operator: port }),
      );

      expect(port.acknowledge).toHaveBeenCalledTimes(2);
    });

    it("reports each retake so the capture log shows it happened", async () => {
      const events: ProcedureProgress[] = [];
      const port = operator({
        confirmReading: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
      });

      await runCaptureProcedure(
        MANUAL,
        context({
          rig: { dut: drifting([11, 22]) },
          operator: port,
          onProgress: (event) => events.push(event),
        }),
      );

      expect(events).toContainEqual({ kind: "retake", series: "spec_sweep", index: 0, attempt: 1 });
    });

    // Nobody is standing over a sweep the rig drives, so nothing should be offered back.
    it("never offers a reading from a sweep the rig drove", async () => {
      const { rig } = fullRig();
      const port = operator();

      await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig, operator: port }));

      expect(port.confirmReading).not.toHaveBeenCalled();
    });
  });

  describe("operator steps", () => {
    it("aborts when a gated instruction is declined", async () => {
      const { rig } = fullRig();
      const declining = operator({ acknowledge: vi.fn(() => Promise.resolve(false)) });

      const aborted = await abortOf(
        runCaptureProcedure(AMBIT_PROCEDURE, context({ rig, operator: declining })),
      );

      expect(aborted.reason).toBeInstanceOf(ProcedureDeclined);
    });

    it("passes the confirmation token through so the port can require it", async () => {
      const { rig } = fullRig();
      const port = operator();

      await runCaptureProcedure(AMBIT_PROCEDURE, context({ rig, operator: port }));

      expect(port.acknowledge).toHaveBeenCalledWith("Install the dark fixture", "DARK");
    });

    it("asks the operator to apply a stimulus the rig cannot", async () => {
      const manual: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              operator: "Set the lamp to {value} and wait for it to stabilise",
              values: [100, 300],
            },
            read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
          },
        ],
      };
      const port = operator();

      const result = await runCaptureProcedure(
        manual,
        context({ rig: { dut: reader({ par_raw: 12 }) }, operator: port }),
      );

      expect(port.acknowledge).toHaveBeenCalledWith(
        "Set the lamp to 100 and wait for it to stabilise",
      );
      expect(result.payload.par_sweep).toHaveLength(2);
    });

    it("interpolates a compound setpoint into the prompt", async () => {
      const soil: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "sweep",
            series: "vwc_curve",
            stimulus: {
              operator: "Insert the probe: {value.medium}, {value.condition}",
              values: [{ medium: "sand", condition: "air_dry" }],
            },
            read: [{ instrument: "dut", command: "read_vwc", as: "vwc_raw" }],
          },
        ],
      };
      const port = operator();

      await runCaptureProcedure(
        soil,
        context({ rig: { dut: reader({ read_vwc: 0.03 }) }, operator: port }),
      );

      expect(port.acknowledge).toHaveBeenCalledWith("Insert the probe: sand, air_dry");
    });

    it("skips an optional read step whose prompt the operator declines", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "compass",
            optional: true,
            prompt: "Rotate the device in a figure 8",
            read: [{ instrument: "dut", command: "calibrate_compass", as: "result" }],
          },
        ],
      };
      const port = operator({ acknowledge: vi.fn(() => Promise.resolve(false)) });

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ calibrate_compass: "ok" }) }, operator: port }),
      );

      expect(port.acknowledge).toHaveBeenCalledWith("Rotate the device in a figure 8");
      expect(result.skipped).toEqual([
        { series: "compass", reason: "operator declined: Rotate the device in a figure 8" },
      ]);
    });

    it("skips an optional sweep when the operator declines a setpoint", async () => {
      const manual: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            optional: true,
            stimulus: { operator: "Set the lamp to {value}", values: [100, 300] },
            read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
          },
        ],
      };
      const port = operator({ acknowledge: vi.fn(() => Promise.resolve(false)) });

      const result = await runCaptureProcedure(
        manual,
        context({ rig: { dut: reader({ par_raw: 12 }) }, operator: port }),
      );

      expect(result.skipped).toEqual([
        { series: "par_sweep", reason: "operator declined a setpoint in par_sweep" },
      ]);
    });

    // `{value}` on a compound setpoint shows the whole thing; `{value.key}` on a
    // scalar has no key to pick and shows the scalar.
    it("interpolates the whole compound setpoint and a keyed scalar", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "sweep",
            series: "first",
            stimulus: { operator: "Prepare {value}", values: [{ medium: "sand" }] },
            read: [{ instrument: "dut", command: "read_vwc", as: "vwc_raw" }],
          },
          {
            kind: "sweep",
            series: "second",
            stimulus: { operator: "Set {value.level}", values: [300] },
            read: [{ instrument: "dut", command: "read_vwc", as: "vwc_raw" }],
          },
        ],
      };
      const port = operator();

      await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ read_vwc: 0.03 }) }, operator: port }),
      );

      expect(port.acknowledge).toHaveBeenCalledWith('Prepare {"medium":"sand"}');
      expect(port.acknowledge).toHaveBeenCalledWith("Set 300");
    });

    it("records a value the rig cannot measure", async () => {
      const manual: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_sweep",
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              { operator: "Enter the handheld meter reading", as: "par_ref", type: "number" },
            ],
          },
        ],
      };
      const port = operator({ readValue: vi.fn(() => Promise.resolve(176.4)) });

      const result = await runCaptureProcedure(
        manual,
        context({ rig: { dut: reader({ par_raw: 148.2 }) }, operator: port }),
      );

      expect(result.payload.par_sweep[0]).toEqual({ par_raw: 148.2, par_ref: 176.4 });
    });
  });

  describe("reads", () => {
    // A port that can no longer reach the operator fails the read; nothing is recorded in its place.
    it("aborts when the operator port fails a value request", async () => {
      const gone = operator({
        readValue: vi.fn(() => Promise.reject(new Error("operator left the bench"))),
      });
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_sweep",
            read: [{ operator: "Enter the reference reading", as: "par_ref", type: "number" }],
          },
        ],
      };

      const aborted = await abortOf(
        runCaptureProcedure(procedure, context({ rig: { dut: reader({}) }, operator: gone })),
      );

      expect(aborted.reason.message).toMatch(/left the bench/);
      expect(aborted.partial.payload).toEqual({});
    });

    it("returns a scalar for a single sample and an array for a repeat", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "temp_cal",
            read: [
              { instrument: "dut", command: "temp", as: "once" },
              { instrument: "dut", command: "temp", as: "sampled", repeat: 3, intervalMs: 10 },
            ],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ temp: 23.1 }) } }),
      );

      expect(result.payload.temp_cal[0].once).toBe(23.1);
      expect(result.payload.temp_cal[0].sampled).toEqual([23.1, 23.1, 23.1]);
    });

    it("waits the declared interval between repeated samples", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "temp_cal",
            read: [
              { instrument: "dut", command: "temp", as: "sampled", repeat: 3, intervalMs: 3000 },
            ],
          },
        ],
      };
      const sleep = vi.fn((_ms: number) => Promise.resolve());

      await runCaptureProcedure(procedure, context({ rig: { dut: reader({ temp: 1 }) }, sleep }));

      // Two waits for three samples: the first is taken immediately.
      expect(sleep.mock.calls.filter(([ms]) => ms === 3000)).toHaveLength(2);
    });

    it("keeps a structured reply whole for the script to pick apart", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "spectral",
            read: [{ instrument: "dut", command: "get_par", as: "reading" }],
          },
        ],
      };
      const structured = { par: 148.2, channels: [415, 388, 402] };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ get_par: structured }) } }),
      );

      expect(result.payload.spectral[0].reading).toBe(JSON.stringify(structured));
    });

    // A console prints its readings as text; the payload and the fit want numbers.
    it("stores a reply that is a number in text as a number, and other text as text", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "identity",
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              { instrument: "dut", command: "get_name", as: "name" },
            ],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ par_raw: "396.96", get_name: "miniPAR" }) } }),
      );

      expect(result.payload.identity[0]).toEqual({ par_raw: 396.96, name: "miniPAR" });
    });

    // A payload cell can hold a numeric series but not a series of anything
    // else, so a repeated text or structured read is kept whole as text.
    it("keeps a repeated non-numeric read whole as text", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "names",
            read: [{ instrument: "dut", command: "get_name", as: "sampled", repeat: 2 }],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ get_name: "Par_REF" }) } }),
      );

      expect(result.payload.names[0].sampled).toBe(JSON.stringify(["Par_REF", "Par_REF"]));
    });

    // A protocol goes to the device whole, and its reply comes back whole.
    it("sends a declared protocol object in place of a command", async () => {
      const scan = { pulses: [20], detectors: [[1, 2]] };
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        protocols: { detector_scan: scan },
        steps: [
          {
            kind: "read",
            series: "colorcal",
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };
      const execute = vi.fn((_command: string | object) =>
        Promise.resolve({ success: true, data: { channels: [415, 388] } }),
      );

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: { read: { execute } } } }),
      );

      expect(execute.mock.calls[0][0]).toBe(scan);
      expect(result.payload.colorcal[0].channels).toBe(JSON.stringify({ channels: [415, 388] }));
    });

    it("aborts when a read names a protocol the procedure does not declare", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "colorcal",
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };

      await expect(
        runCaptureProcedure(procedure, context({ rig: { dut: reader({}) } })),
      ).rejects.toThrow(/does not declare/);
    });

    it("aborts when a device read fails rather than recording a hole", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_sweep",
            read: [{ instrument: "dut", command: "get_par", as: "par_raw" }],
          },
        ],
      };
      const failing: RigBinding = {
        read: {
          execute: vi.fn(() =>
            Promise.resolve({ success: false, error: new Error("device stopped answering") }),
          ),
        },
      };

      await expect(
        runCaptureProcedure(procedure, context({ rig: { dut: failing } })),
      ).rejects.toThrow(/device stopped answering/);
    });

    // A bench that is told the level and asked for the trace in one command
    // carries the setpoint in the command text.
    it("interpolates the sweep's setpoint into a read command, once per setpoint", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
            read: [{ instrument: "dut", command: "arrun2,{value},1", as: "par_raw" }],
          },
        ],
      };
      const dut = reader({ "arrun2,0.8,1": 148.2, "arrun2,2.4,1": 402.2 });

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut, lamp: setpointTarget() } }),
      );

      expect(result.payload.par_sweep.map((row) => row.par_raw)).toEqual([148.2, 402.2]);
    });

    it("interpolates a compound setpoint's key into a read command", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "sweep",
            series: "vwc_curve",
            stimulus: {
              operator: "Insert the probe: {value.medium}",
              values: [{ medium: "sand", condition: "air_dry" }],
            },
            read: [{ instrument: "dut", command: "read_vwc,{value.medium}", as: "vwc_raw" }],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ "read_vwc,sand": 0.03 }) } }),
      );

      expect(result.payload.vwc_curve[0].vwc_raw).toBe(0.03);
    });

    it("interpolates the setpoint into an operator read's prompt inside a sweep", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
        steps: [
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: { instrument: "lamp", set: "current_a", values: [0.8] },
            read: [
              { operator: "Enter the meter reading at {value} A", as: "par_ref", type: "number" },
            ],
          },
        ],
      };
      const port = operator({ readValue: vi.fn(() => Promise.resolve(176.4)) });

      await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({}), lamp: setpointTarget() }, operator: port }),
      );

      expect(port.readValue).toHaveBeenCalledWith("Enter the meter reading at 0.8 A", "number");
    });

    it("sends a resolved clone of a protocol that interpolates, leaving the declaration alone", async () => {
      const scan = {
        pulses: ["{value}"],
        label: "step {value}",
        detectors: [[1, 2]],
        autogain: { start_value: "{value}" },
      };
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        protocols: { detector_scan: scan },
        steps: [
          {
            kind: "sweep",
            series: "colorcal",
            stimulus: { operator: "Set the lamp to {value}", values: [20, 40] },
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };
      const execute = vi.fn((_command: string | object) =>
        Promise.resolve({ success: true, data: { channels: [415] } }),
      );

      await runCaptureProcedure(procedure, context({ rig: { dut: { read: { execute } } } }));

      // A lone placeholder carries the setpoint's own type; text around one keeps it a string.
      expect(execute.mock.calls.map(([command]) => command)).toEqual([
        { pulses: [20], label: "step 20", detectors: [[1, 2]], autogain: { start_value: 20 } },
        { pulses: [40], label: "step 40", detectors: [[1, 2]], autogain: { start_value: 40 } },
      ]);
      expect(execute.mock.calls[0][0]).not.toBe(scan);
      expect(execute.mock.calls[0][0]).not.toBe(execute.mock.calls[1][0]);
      expect(scan).toEqual({
        pulses: ["{value}"],
        label: "step {value}",
        detectors: [[1, 2]],
        autogain: { start_value: "{value}" },
      });
    });

    it("sends the declared protocol object itself when a sweep has nothing to interpolate", async () => {
      const scan = { pulses: [20], detectors: [[1, 2]] };
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        protocols: { detector_scan: scan },
        steps: [
          {
            kind: "sweep",
            series: "colorcal",
            stimulus: { operator: "Clamp onto reference card {value}", values: ["white_a"] },
            read: [{ instrument: "dut", protocol: "detector_scan", as: "channels" }],
          },
        ],
      };
      const execute = vi.fn((_command: string | object) =>
        Promise.resolve({ success: true, data: { channels: [415] } }),
      );

      await runCaptureProcedure(procedure, context({ rig: { dut: { read: { execute } } } }));

      expect(execute.mock.calls[0][0]).toBe(scan);
    });

    it("leaves a read step's command as declared, having no setpoint to resolve", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "read",
            series: "par_sweep",
            read: [{ instrument: "dut", command: "par,{value}", as: "par_raw" }],
          },
        ],
      };

      const result = await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ "par,{value}": 12 }) } }),
      );

      expect(result.payload.par_sweep[0].par_raw).toBe(12);
    });
  });

  describe("settle steps", () => {
    it("waits out a settle step and reports it", async () => {
      const procedure: CaptureProcedure = {
        instruments: [{ role: "dut" }],
        steps: [
          { kind: "settle", ms: 1500 },
          {
            kind: "read",
            series: "par_sweep",
            read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
          },
        ],
      };
      const sleep = vi.fn((_ms: number) => Promise.resolve());
      const events: ProcedureProgress[] = [];

      await runCaptureProcedure(
        procedure,
        context({ rig: { dut: reader({ par_raw: 1 }) }, sleep, onProgress: (e) => events.push(e) }),
      );

      expect(sleep).toHaveBeenCalledWith(1500);
      expect(events).toContainEqual({
        kind: "step",
        index: 0,
        total: 2,
        description: "Settle 1500 ms",
      });
    });
  });

  describe("set steps", () => {
    const WITH_SUPPLY_SETUP: CaptureProcedure = {
      instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM" }],
      steps: [
        { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
        { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
        {
          kind: "read",
          series: "par_sweep",
          read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
        },
      ],
    };

    it("applies each setpoint on its own and reports it", async () => {
      const lamp = setpointTarget();
      const events: ProcedureProgress[] = [];

      const result = await runCaptureProcedure(
        WITH_SUPPLY_SETUP,
        context({
          rig: { dut: reader({ par_raw: 1 }), lamp },
          onProgress: (event) => events.push(event),
        }),
      );

      expect(lamp.applied).toEqual([
        ["current_a", 0],
        ["voltage_v", 25],
      ]);
      expect(events).toContainEqual({
        kind: "step",
        index: 1,
        total: 3,
        description: "Set lamp voltage_v to 25",
      });
      expect(Object.keys(result.payload)).toEqual(["par_sweep"]);
    });

    // A set step feeds no series, so nothing can mark it optional: the
    // instrument it names has to be on the bench.
    it("aborts when the instrument is absent", async () => {
      const run = runCaptureProcedure(
        WITH_SUPPLY_SETUP,
        context({ rig: { dut: reader({ par_raw: 1 }) } }),
      );

      await expect(run).rejects.toBeInstanceOf(ProcedureAborted);
      await expect(run).rejects.toThrow(
        'Procedure aborted: Cannot set lamp current_a: instrument "lamp" is not connected',
      );
    });
  });

  describe("stopping a run", () => {
    // Without a way to stop, the wizard's only exit closed the ports under a running
    // sweep, and a setpoint could land after the rig had been rested.
    it("stops between setpoints and keeps the rows it had confirmed", async () => {
      const { rig } = fullRig();
      const controller = new AbortController();
      const applied: [string, number][] = [];
      // The operator presses Stop while the second point is being set up.
      const lamp: RigBinding = {
        setpoint: {
          applySetpoint: (name, value) => {
            applied.push([name, value]);
            if (applied.length === 2) {
              controller.abort();
            }
            return Promise.resolve();
          },
        },
      };

      const aborted = await abortOf(
        runCaptureProcedure(
          AMBIT_PROCEDURE,
          context({ rig: { ...rig, lamp }, signal: controller.signal }),
        ),
      );

      expect(aborted.reason).toBeInstanceOf(ProcedureStopped);
      // The first point was read and confirmed; the second never was.
      expect(aborted.partial.payload.par_sweep).toHaveLength(1);
      expect(applied).toEqual([
        ["current_a", 0.8],
        ["current_a", 2.4],
      ]);
    });

    it("cuts a settle short rather than driving the rig through it", async () => {
      const { rig } = fullRig();
      const controller = new AbortController();
      const procedure: CaptureProcedure = {
        ...AMBIT_PROCEDURE,
        steps: [{ kind: "settle", ms: 60_000 }],
      };
      const run = abortOf(
        runCaptureProcedure(
          procedure,
          context({ rig, signal: controller.signal, sleep: () => new Promise(() => undefined) }),
        ),
      );
      controller.abort();

      const aborted = await run;

      expect(aborted.reason).toBeInstanceOf(ProcedureStopped);
    });

    it("does not start a run whose signal is already aborted", async () => {
      const { rig, lamp } = fullRig();
      const controller = new AbortController();
      controller.abort();

      const aborted = await abortOf(
        runCaptureProcedure(AMBIT_PROCEDURE, context({ rig, signal: controller.signal })),
      );

      expect(aborted.reason).toBeInstanceOf(ProcedureStopped);
      expect(lamp.applied).toEqual([]);
    });
  });

  describe("what a step is refused for", () => {
    // The contract refuses the same cell at submit, after the whole session; at the read
    // the step can be retaken and the definition corrected.
    it("refuses a device reply longer than a cell holds, at the read", async () => {
      const { rig } = fullRig();
      const verbose = reader({ get_par: { data_raw: "x".repeat(70_000) } });

      const aborted = await abortOf(
        runCaptureProcedure(AMBIT_PROCEDURE, context({ rig: { ...rig, dut: verbose } })),
      );

      expect(aborted.reason.message).toMatch(/a cell holds at most/);
    });

    // A decline is the operator's decision, and the wizard says so; a rig fault reads as
    // a bench that needs fixing.
    it("raises a declined required read as a decline, not a rig fault", async () => {
      const { rig } = fullRig();
      const procedure: CaptureProcedure = {
        ...AMBIT_PROCEDURE,
        steps: [
          {
            kind: "read",
            series: "compass",
            prompt: "Rotate the device in a figure 8",
            read: [{ instrument: "dut", command: "get_par", as: "heading" }],
          },
        ],
      };

      const aborted = await abortOf(
        runCaptureProcedure(
          procedure,
          context({
            rig,
            operator: operator({ acknowledge: vi.fn(() => Promise.resolve(false)) }),
          }),
        ),
      );

      expect(aborted.reason).toBeInstanceOf(ProcedureDeclined);
    });
  });

  describe("shutdownRig", () => {
    // Leaving a lamp driven because a sibling instrument's port died is the
    // one outcome a bench must never see, and the failure to zero it the one
    // thing the operator must be told.
    it("returns every instrument to rest even when one fails, then says which failed", async () => {
      const failing = createMockTransport();
      vi.mocked(failing.send).mockRejectedValue(new Error("port closed"));
      const healthy = createMockTransport();
      const first = new KiprimDcSource();
      const second = new KiprimDcSource();
      await first.initialize(failing);
      await second.initialize(healthy);

      await expect(shutdownRig([first, second])).rejects.toThrow(/not at rest.*port closed/);

      expect(healthy.send).toHaveBeenCalledWith(KIPRIM_COMMANDS.setCurrent(0));
    });
  });

  describe("rig validation", () => {
    it("refuses a procedure that declares no device under test", async () => {
      const headless: CaptureProcedure = {
        instruments: [{ role: "lamp", handshake: "KIPRIM" }],
        steps: [{ kind: "operator", prompt: "nothing to do" }],
      };

      // Declared before any step runs, so this is not a mid-run abort.
      await expect(runCaptureProcedure(headless, context())).rejects.toBeInstanceOf(
        ProcedureRigError,
      );
    });
  });

  // The simplest procedure, automated: the operator replaced by a supply on
  // the lamp and a reference photodiode, both real instrument classes bound
  // into the rig rather than stubs.
  describe("automated MiniPAR rig", () => {
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
          stimulus: { instrument: "lamp", set: "current_a", values: [0.5, 1.5, 0.0] },
          read: [
            { instrument: "dut", command: "par_raw", as: "par_raw" },
            { instrument: "par_ref", command: "par", as: "par_ref" },
          ],
        },
      ],
      verify: [
        { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
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

    function supplyTransport(): MockTransport {
      const transport = createMockTransport();
      vi.mocked(transport.send).mockResolvedValue(undefined);
      return transport;
    }

    function referenceTransport(values: string[]): MockTransport {
      const transport = createMockTransport();
      const queue = [...values];
      vi.mocked(transport.send).mockImplementation((sent: string) => {
        if (sent === "getPAR()\r") {
          const value = queue.shift() ?? "0";
          setTimeout(() => transport.simulateData(`getPAR()\r\n${value}\r\n>>> `), 0);
        }
        return Promise.resolve();
      });
      return transport;
    }

    it("drives the supply and reads the reference through real instrument bindings", async () => {
      const lampTransport = supplyTransport();
      const lamp = new KiprimDcSource();
      await lamp.initialize(lampTransport);
      const reference = new MicroPythonParReference({ readTimeoutMs: 200 });
      await reference.initialize(referenceTransport(["143.1", "402.2", "0.7"]));

      const result = await runCaptureProcedure(
        AUTOMATED_MINIPAR,
        context({
          rig: {
            dut: reader({ par_raw: 150.0 }),
            lamp: bindBenchInstrument(lamp),
            par_ref: bindBenchInstrument(reference),
          },
        }),
      );

      expect(result.payload.par_sweep.map((row) => row.par_ref)).toEqual([143.1, 402.2, 0.7]);
      // The supply is brought to rest and given its voltage limit before the sweep drives it.
      expect(vi.mocked(lampTransport.send).mock.calls.map(([payload]) => payload)).toEqual([
        "current 0.000\r\n",
        "voltage 25.000\r\n",
        "current 0.500\r\n",
        "current 1.500\r\n",
        "current 0.000\r\n",
      ]);
    });

    // After the write the same rig checks one current: calibrated PAR beside the reference.
    it("runs the verify phase through the same bindings after the write", async () => {
      const lampTransport = supplyTransport();
      const lamp = new KiprimDcSource();
      await lamp.initialize(lampTransport);
      const reference = new MicroPythonParReference({ readTimeoutMs: 200 });
      await reference.initialize(referenceTransport(["402.2"]));

      const result = await runVerificationProcedure(
        AUTOMATED_MINIPAR,
        context({
          rig: {
            dut: reader({ par_raw: 150.0, par: 402.9 }),
            lamp: bindBenchInstrument(lamp),
            par_ref: bindBenchInstrument(reference),
          },
        }),
      );

      expect(result.payload).toEqual({ par_check: [{ par: 402.9, par_ref: 402.2 }] });
      expect(vi.mocked(lampTransport.send).mock.calls.map(([payload]) => payload)).toEqual([
        "current 0.800\r\n",
        "current 0.000\r\n",
      ]);
    });

    it("captures nothing when the procedure declares no verify phase", async () => {
      const result = await runVerificationProcedure(
        { ...AUTOMATED_MINIPAR, verify: undefined },
        context({ rig: { dut: reader({ par: 402.9 }) } }),
      );

      expect(result).toEqual({ payload: {}, skipped: [] });
    });

    it("binds a reference as read-only and a supply as setpoint-only", () => {
      const reference = bindBenchInstrument(new MicroPythonParReference());
      const supply = bindBenchInstrument(new KiprimDcSource());

      expect(reference.read).toBeDefined();
      expect(reference.setpoint).toBeUndefined();
      expect(supply.setpoint).toBeDefined();
      expect(supply.read).toBeUndefined();
    });

    it("surfaces a reference fault as a failed read rather than a thrown binding", async () => {
      const reference = new MicroPythonParReference({ readTimeoutMs: 50 });
      await reference.initialize(createMockTransport());
      const binding = bindBenchInstrument(reference);

      const result = await binding.read?.execute("par");

      expect(result?.success).toBe(false);
      expect(result?.error?.message).toMatch(/did not answer/);
    });

    // A serial stack can reject with a bare string; the run record still
    // needs an Error to carry.
    it("wraps a non-Error read failure", async () => {
      const transport = createMockTransport();
      vi.mocked(transport.send).mockRejectedValue("port gone");
      const reference = new MicroPythonParReference({ readTimeoutMs: 50 });
      await reference.initialize(transport);
      const binding = bindBenchInstrument(reference);

      const result = await binding.read?.execute("par");

      expect(result?.success).toBe(false);
      expect(result?.error).toBeInstanceOf(Error);
      expect(result?.error?.message).toBe("port gone");
    });

    it("refuses a protocol object aimed at a reference", async () => {
      const binding = bindBenchInstrument(new MicroPythonParReference());

      const result = await binding.read?.execute({ label: "arrun" });

      expect(result?.success).toBe(false);
      expect(result?.error?.message).toMatch(/reading name, not a protocol/);
    });
  });
});
