import { describe, expect, it, vi } from "vitest";

import type { MockTransport } from "../driver/testing/mock-transport";
import { createMockTransport } from "../driver/testing/mock-transport";
import { KIPRIM_COMMANDS } from "../instrument/kiprim/commands";
import { KiprimDcSource } from "../instrument/kiprim/instrument";
import { MicroPythonParReference } from "../instrument/micropython-par/instrument";
import { bindBenchInstrument, runCaptureProcedure, shutdownRig } from "./interpreter";
import type { ProcedureContext, RigBinding } from "./interpreter";
import { ProcedureAborted, ProcedureDeclined, ProcedureRigError } from "./operator";
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

      const aborted = await runCaptureProcedure(
        AMBIT_PROCEDURE,
        context({ rig: withoutReference }),
      ).catch((error: unknown) => error);

      expect(aborted).toBeInstanceOf(ProcedureAborted);
      expect((aborted as ProcedureAborted).reason).toBeInstanceOf(ProcedureRigError);
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

      const aborted = (await runCaptureProcedure(
        AMBIT_PROCEDURE,
        context({ rig: { ...rig, emit_ref: dyingReference } }),
      ).catch((error: unknown) => error)) as ProcedureAborted;

      expect(aborted).toBeInstanceOf(ProcedureAborted);
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
  });

  describe("operator steps", () => {
    it("aborts when a gated instruction is declined", async () => {
      const { rig } = fullRig();
      const declining = operator({ acknowledge: vi.fn(() => Promise.resolve(false)) });

      const aborted = await runCaptureProcedure(
        AMBIT_PROCEDURE,
        context({ rig, operator: declining }),
      ).catch((error: unknown) => error);

      expect((aborted as ProcedureAborted).reason).toBeInstanceOf(ProcedureDeclined);
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

  describe("shutdownRig", () => {
    // Leaving a lamp driven because a sibling instrument's port died is the
    // one outcome a bench must never see.
    it("returns every instrument to rest even when one fails", async () => {
      const failing = createMockTransport();
      vi.mocked(failing.send).mockRejectedValue(new Error("port closed"));
      const healthy = createMockTransport();
      const first = new KiprimDcSource();
      const second = new KiprimDcSource();
      await first.initialize(failing);
      await second.initialize(healthy);

      await shutdownRig([first, second]);

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
      expect(vi.mocked(lampTransport.send).mock.calls.map(([payload]) => payload)).toEqual([
        "current 0.500\r\n",
        "current 1.500\r\n",
        "current 0.000\r\n",
      ]);
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
