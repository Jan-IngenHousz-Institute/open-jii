import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { CalibrationStepsEditor } from "./calibration-steps-editor";
import type { ProcedurePhase } from "./procedure-edits";

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

function stepCards() {
  return screen.getAllByRole("listitem").filter((row) => within(row).queryByText(/^\d+$/) !== null);
}

/** The kind, then the line of prose beside it, as the i18n stub renders them. */
function menuItemName(kind: string) {
  return `${kind} iot.calibration.procedure.kind.${kind}`;
}

async function addStepOfKind(user: ReturnType<typeof renderEditor>["user"], kind: string) {
  await user.click(screen.getByRole("button", { name: /iot.calibration.procedure.addStep/ }));
  await user.click(await screen.findByRole("menuitem", { name: menuItemName(kind) }));
}

describe("CalibrationStepsEditor", () => {
  it("lists the phase in the order the bench will run it", () => {
    renderEditor();

    expect(stepCards()).toHaveLength(2);
    expect(within(stepCards()[0]).getByText("set")).toBeInTheDocument();
    expect(within(stepCards()[1]).getByText("sweep")).toBeInTheDocument();
  });

  // Nothing is typed that the rig already knows: a setpoint an instrument does not have
  // is only refused at the bench, halfway through a sweep.
  it("offers the setpoints the instrument a step drives actually has", async () => {
    const { user } = renderEditor();

    await user.click(within(stepCards()[0]).getAllByRole("combobox")[1]);

    expect(await screen.findByRole("option", { name: "current_a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "voltage_v" })).toBeInTheDocument();
  });

  it("offers a bench instrument's readings, and the family's commands for the device", async () => {
    const { user } = renderEditor();
    const reads = within(stepCards()[1]).getAllByRole("listitem");

    // The reference answers a fixed set of readings, so the field is a choice.
    await user.click(within(reads[1]).getAllByRole("combobox")[1]);
    expect(await screen.findByRole("option", { name: "par_raw" })).toBeInTheDocument();

    // The device answers whatever its firmware knows, so the field takes text and offers.
    const command = within(reads[0]).getByLabelText("iot.calibration.procedure.command");
    expect(command).toHaveValue("par_raw");
  });

  // A reading that takes one sample at the driver's own pace is the common one, so its
  // three knobs stay out of the way until they are wanted.
  it("keeps the sampling knobs folded away until asked for", async () => {
    const { user } = renderEditor();
    const [read] = within(stepCards()[1]).getAllByRole("listitem");

    expect(within(read).queryByLabelText("iot.calibration.procedure.timeout")).toBeNull();

    await user.click(
      within(read).getByRole("button", { name: "iot.calibration.procedure.sampling" }),
    );

    expect(
      within(stepCards()[1]).getAllByLabelText("iot.calibration.procedure.timeout")[0],
    ).toBeInTheDocument();
  });

  it("adds a step of a kind the contract accepts", async () => {
    const { onChange, user } = renderEditor();

    await addStepOfKind(user, "settle");

    const added = onChange.mock.calls[0][0];
    expect(added.steps).toHaveLength(3);
    expect(zCaptureProcedure.safeParse(added).success).toBe(true);
  });

  // A set step needs something to drive; a family with no device setpoints and a rig with
  // no instruments has nothing.
  it("will not offer a set step when nothing can be driven", async () => {
    const { user } = renderEditor({ ...bench, instruments: [{ role: "dut" }] });

    await user.click(screen.getByRole("button", { name: /iot.calibration.procedure.addStep/ }));

    expect(await screen.findByRole("menuitem", { name: menuItemName("set") })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("moves a step, because order is the procedure", async () => {
    const { onChange, user } = renderEditor();

    await user.click(
      within(stepCards()[0]).getByRole("button", { name: "iot.calibration.procedure.moveDown" }),
    );

    expect(onChange.mock.calls[0][0].steps.map((step) => step.kind)).toEqual(["sweep", "set"]);
  });

  it("rewrites the points a sweep steps through", async () => {
    const { onChange, user } = renderEditor();

    const values = within(stepCards()[1]).getByLabelText("iot.calibration.procedure.values");
    await user.clear(values);
    await user.type(values, "1{Enter}2{Enter}3");

    const swept = onChange.mock.calls.at(-1)?.[0].steps[1];
    expect(swept).toMatchObject({ stimulus: { values: [1, 2, 3] } });
  });

  // The verify phase is absent until it holds a step, because the contract refuses an
  // empty one.
  it("creates the verify phase with its first step and drops it with its last", async () => {
    const { onChange, user } = renderEditor(bench, "verify");

    await addStepOfKind(user, "settle");
    expect(onChange.mock.calls[0][0].verify).toHaveLength(1);

    await user.click(
      within(stepCards()[0]).getByRole("button", { name: "iot.calibration.procedure.removeStep" }),
    );
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty("verify");
  });
});
