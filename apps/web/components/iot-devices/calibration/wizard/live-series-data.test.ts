import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { ProcedureProgress } from "@repo/iot";

import { liveSeriesData } from "./live-series-data";

const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4, 6.6] },
      read: [
        { instrument: "dut", command: "par_raw", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "read",
      series: "dark",
      read: [{ instrument: "dut", command: "baseline", as: "channels" }],
    },
  ],
};

function row(series: string, index: number, values: Record<string, unknown>): ProcedureProgress {
  return { kind: "row", series, index, row: values } as ProcedureProgress;
}

describe("liveSeriesData", () => {
  it("draws nothing before the first point is kept", () => {
    const events: ProcedureProgress[] = [
      { kind: "step", index: 0, total: 2, description: "Sweep par_sweep" },
      { kind: "setpoint", series: "par_sweep", index: 0, total: 3, value: 0.8 },
    ];

    expect(liveSeriesData(events, PROCEDURE)).toBeNull();
  });

  // The sweep's own axis is the setpoint it was taken at, and every numeric reading in the
  // row is a trace against it.
  it("builds one trace per numeric column against the stimulus", () => {
    const events: ProcedureProgress[] = [
      row("par_sweep", 0, { stimulus: 0.8, par_raw: 209.5, par_ref: 200 }),
      row("par_sweep", 1, { stimulus: 2.4, par_raw: 626.2, par_ref: 600 }),
    ];

    const live = liveSeriesData(events, PROCEDURE);

    expect(live).toMatchObject({ series: "par_sweep", taken: 2, expected: 3 });
    expect(live?.traces).toEqual([
      { name: "par_raw", x: [0.8, 2.4], y: [209.5, 626.2] },
      { name: "par_ref", x: [0.8, 2.4], y: [200, 600] },
    ]);
  });

  // A finished series belongs to the step just gone; what is on screen has to be what the
  // bench is measuring now.
  it("stops drawing a series once it is complete", () => {
    const events: ProcedureProgress[] = [
      row("par_sweep", 0, { stimulus: 0.8, par_raw: 209.5 }),
      { kind: "series", series: "par_sweep", rows: 1 },
    ];

    expect(liveSeriesData(events, PROCEDURE)).toBeNull();
  });

  it("follows the run into the next series", () => {
    const events: ProcedureProgress[] = [
      row("par_sweep", 0, { stimulus: 0.8, par_raw: 209.5 }),
      { kind: "series", series: "par_sweep", rows: 1 },
      row("dark", 0, { reading: 12 }),
    ];

    expect(liveSeriesData(events, PROCEDURE)).toMatchObject({ series: "dark", expected: 1 });
  });

  // A read step has no setpoint, so the point's position is the only axis it has.
  it("falls back to the point's position when there is no stimulus", () => {
    const events: ProcedureProgress[] = [
      row("dark", 0, { reading: 12 }),
      row("dark", 1, { reading: 13 }),
    ];

    expect(liveSeriesData(events, PROCEDURE)?.traces).toEqual([
      { name: "reading", x: [1, 2], y: [12, 13] },
    ]);
  });

  // A structured reply still reaches the record; it is simply not a line.
  it("leaves out a column that is not a number", () => {
    const events: ProcedureProgress[] = [
      row("dark", 0, { channels: [1, 2, 3], note: "clear", reading: 12 }),
    ];

    expect(liveSeriesData(events, PROCEDURE)?.traces).toEqual([
      { name: "reading", x: [1], y: [12] },
    ]);
  });

  it("reports how many points a series takes when the procedure declares none", () => {
    const events: ProcedureProgress[] = [row("stray", 0, { reading: 1 })];

    expect(liveSeriesData(events, PROCEDURE)).toMatchObject({ expected: null, taken: 1 });
  });
});
