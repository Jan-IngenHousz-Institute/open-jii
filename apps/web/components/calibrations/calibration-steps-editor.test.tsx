import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { CalibrationStepsEditor } from "./calibration-steps-editor";
import type { ProcedurePhase, StepKind } from "./procedure-edits";

const bench: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
    { role: "par_ref", handshake: "Par_REF", model: "minipar-reference" },
  ],
  steps: [
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
      read: [
        { instrument: "dut", command: "par_raw", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
  ],
};

/** The page holds the document and hands it back, so an edit has to round-trip to show. */
function Host({
  initial,
  phase,
  family,
  onChange,
}: {
  initial: CaptureProcedure;
  phase: ProcedurePhase;
  family: CalibrationFamily;
  onChange: (next: CaptureProcedure) => void;
}) {
  const [edited, setEdited] = useState(initial);

  return (
    <CalibrationStepsEditor
      procedure={edited}
      phase={phase}
      family={family}
      canEdit
      onChange={(next) => {
        setEdited(next);
        onChange(next);
      }}
    />
  );
}

function renderEditor(
  initial = bench,
  phase: ProcedurePhase = "steps",
  family: CalibrationFamily = "minipar",
) {
  const onChange = vi.fn<(next: CaptureProcedure) => void>();
  render(<Host initial={initial} phase={phase} family={family} onChange={onChange} />);
  return { onChange, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

/** Each cell says what it does while closed; that line is how a phase reads. */
function stepLines() {
  return screen.queryAllByTestId("step-label").map((node) => node.textContent);
}

/** The rails sit before every cell, so "the last one" appends to the phase. */
function insertButtons(kind: StepKind) {
  return screen.getAllByRole("button", { name: `iot.calibration.procedure.kindName.${kind}` });
}

describe("CalibrationStepsEditor", () => {
  it("reads as a document: one line per step, in running order", () => {
    renderEditor();

    expect(stepLines()).toEqual([
      "iot.calibration.procedure.label.set",
      "iot.calibration.procedure.label.sweepInstrument",
    ]);
  });

  // Nothing is typed that the rig already knows: a setpoint an instrument does not have
  // is only refused at the bench, halfway through a sweep.
  it("offers the setpoints the instrument a step drives actually has", async () => {
    const { user } = renderEditor();

    await user.click(screen.getAllByLabelText("iot.calibration.procedure.setpoint")[0]);

    expect(await screen.findByRole("option", { name: "current_a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "voltage_v" })).toBeInTheDocument();
  });

  it("offers a bench instrument's readings, and the family's commands for the device", async () => {
    const { user } = renderEditor();

    // The reference answers a fixed set of readings, so the field is a choice.
    await user.click(screen.getByLabelText("iot.calibration.procedure.reading"));
    expect(await screen.findByRole("option", { name: "par_raw" })).toBeInTheDocument();

    // The device answers whatever its firmware knows, so the field takes text and offers.
    expect(screen.getByLabelText("iot.calibration.procedure.command")).toHaveValue("par_raw");
  });

  // A reading that takes one sample at the driver's own pace is the common one, so its
  // three knobs stay out of the way until they are wanted.
  it("keeps the sampling knobs folded away until asked for", async () => {
    const { user } = renderEditor();

    expect(screen.queryByLabelText("iot.calibration.procedure.timeout")).toBeNull();

    await user.click(
      screen.getAllByRole("button", { name: "iot.calibration.procedure.sampling" })[0],
    );

    expect(screen.getByLabelText("iot.calibration.procedure.timeout")).toBeInTheDocument();
  });

  it("inserts a step where the author asked for it, not at the end", async () => {
    const { onChange, user } = renderEditor();

    // The first rail sits above the first cell.
    await user.click(insertButtons("settle")[0]);

    const added = onChange.mock.calls[0][0];
    expect(added.steps.map((step) => step.kind)).toEqual(["settle", "set", "sweep"]);
    expect(zCaptureProcedure.safeParse(added).success).toBe(true);
  });

  // A set step needs something to drive; a rig of nothing but the device has nothing.
  it("will not offer a set step when nothing can be driven", () => {
    renderEditor({ ...bench, instruments: [{ role: "dut" }] });

    expect(insertButtons("set")[0]).toBeDisabled();
    expect(insertButtons("sweep")[0]).toBeEnabled();
  });

  it("moves a step, because order is the procedure", async () => {
    const { onChange, user } = renderEditor();

    await user.click(
      screen.getAllByRole("button", { name: "iot.calibration.procedure.moveDown" })[0],
    );

    expect(onChange.mock.calls[0][0].steps.map((step) => step.kind)).toEqual(["sweep", "set"]);
  });

  it("rewrites the points a sweep steps through", async () => {
    const { onChange, user } = renderEditor();

    const values = screen.getByLabelText("iot.calibration.procedure.values");
    await user.clear(values);
    await user.type(values, "1{Enter}2{Enter}3");

    expect(onChange.mock.calls.at(-1)?.[0].steps[1]).toMatchObject({
      stimulus: { values: [1, 2, 3] },
    });
  });

  // The verify phase is absent until it holds a step, because the contract refuses an
  // empty one.
  it("creates the verify phase with its first step and drops it with its last", async () => {
    const { onChange, user } = renderEditor(bench, "verify");

    await user.click(
      screen.getByRole("button", { name: "iot.calibration.procedure.kindName.settle" }),
    );
    expect(onChange.mock.calls[0][0].verify).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.removeStep" }));
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty("verify");
  });
});
