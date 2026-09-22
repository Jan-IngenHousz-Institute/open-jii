import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { CalibrationStepsEditor } from "./calibration-steps-editor";
import type { ProcedurePhase, StepKind } from "./procedure-edits";

// A sweep draws its points, and Plotly has no business in jsdom. Mocked at the wrapper,
// because that is where the dynamic import happens.
vi.mock("@/components/charts/scatter-chart", () => ({
  ScatterChart: () => <div data-testid="scatter" />,
}));

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

/** A step is one sentence, and the phase is the sentences in running order. */
function stepLines() {
  return screen.queryAllByRole("listitem").map((node) => node.textContent);
}

async function addStep(user: ReturnType<typeof userEvent.setup>, kind: StepKind) {
  await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.addStep" }));
  // Each item carries its kind and a line about it, so the name is matched rather than equalled.
  await user.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(`kindName\\.${kind}\\b`),
    }),
  );
}

/** A value reads as text until it is clicked, so a test reaches one the way a person does. */
async function openToken(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  label: string,
) {
  await user.click(within(scope).getByRole("button", { name: label }));
  return within(scope).getByRole("textbox", { name: label });
}

describe("CalibrationStepsEditor", () => {
  it("reads as a document: one line per step, in running order", () => {
    renderEditor();

    const lines = stepLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("lamp");
    expect(lines[0]).toContain("current_a");
    expect(lines[1]).toContain("par_sweep");
  });

  // Every name a step can hold comes from the rig above it; a typed one stalls at the bench.
  it("offers the setpoints the instrument a step drives actually has", async () => {
    const { user } = renderEditor();

    const [line] = screen.getAllByRole("listitem");
    await user.click(
      within(line).getByRole("combobox", { name: "iot.calibration.procedure.setpoint" }),
    );

    expect(await screen.findByRole("option", { name: /current_a/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /voltage_v/ })).toBeInTheDocument();
  });

  it("offers a bench instrument's readings as a closed list, and the device's as free text", async () => {
    const { user } = renderEditor();

    const sweep = screen.getAllByRole("listitem")[1];
    // par_ref is bench equipment, so what it answers is fixed.
    expect(
      within(sweep).getByRole("combobox", { name: "iot.calibration.procedure.reading" }),
    ).toBeInTheDocument();
    // The device answers whatever its firmware knows, so its command is typed.
    await user.click(
      within(sweep).getByRole("button", { name: "iot.calibration.procedure.command" }),
    );
    expect(
      within(sweep).getByRole("textbox", { name: "iot.calibration.procedure.command" }),
    ).toHaveValue("par_raw");
  });

  it("appends a step to the phase", async () => {
    const { onChange, user } = renderEditor();

    await addStep(user, "settle");

    expect(onChange.mock.calls[0][0].steps.map((step) => step.kind)).toEqual([
      "set",
      "sweep",
      "settle",
    ]);
  });

  it("will not offer a set step when nothing can be driven", async () => {
    const { user } = renderEditor(
      { instruments: [{ role: "dut" }], steps: [] },
      "steps",
      // A MiniPAR drives nothing of its own, so a rig of just the device drives nothing.
      "minipar",
    );

    await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.addStep" }));

    // Radix keeps a disabled item in the menu; what matters is that it cannot be chosen.
    const item = await screen.findByText("iot.calibration.procedure.kindName.set");
    expect(item.closest("[role='menuitem']")).toHaveAttribute("aria-disabled", "true");
  });

  it("opens a new sweep on a setpoint the rig can drive", async () => {
    const { onChange, user } = renderEditor();

    await addStep(user, "sweep");

    const added = onChange.mock.calls[0][0].steps.at(-1);
    expect(added?.kind === "sweep" && added.stimulus).toMatchObject({
      instrument: "lamp",
      set: "current_a",
    });
  });

  it("leaves a sweep to the operator when the rig drives nothing", async () => {
    const { onChange, user } = renderEditor(
      { instruments: [{ role: "dut" }], steps: [] },
      "steps",
      // A MiniPAR drives nothing of its own, so a rig of just the device drives nothing.
      "minipar",
    );

    await addStep(user, "sweep");

    const added = onChange.mock.calls[0][0].steps.at(-1);
    expect(added?.kind === "sweep" && "operator" in added.stimulus).toBe(true);
  });

  it("moves a step, because order is the procedure", async () => {
    const { onChange, user } = renderEditor();

    const [line] = screen.getAllByRole("listitem");
    await user.click(
      within(line).getByRole("button", { name: "iot.calibration.procedure.moveDown" }),
    );

    expect(onChange.mock.calls[0][0].steps.map((step) => step.kind)).toEqual(["sweep", "set"]);
  });

  it("rewrites the points a sweep steps through", async () => {
    const { onChange, user } = renderEditor();

    const sweep = screen.getAllByRole("listitem")[1];
    const values = await openToken(user, sweep, "iot.calibration.procedure.values");
    await user.clear(values);
    await user.type(values, "0, 1, 2");
    await user.tab();

    const step = onChange.mock.calls.at(-1)?.[0].steps[1];
    expect(step?.kind === "sweep" && step.stimulus.values).toEqual([0, 1, 2]);
  });

  it("creates the verify phase with its first step and drops it with its last", async () => {
    const { onChange, user } = renderEditor(bench, "verify");

    await addStep(user, "settle");
    expect(onChange.mock.calls[0][0].verify).toHaveLength(1);

    const [line] = screen.getAllByRole("listitem");
    await user.click(
      within(line).getByRole("button", { name: "iot.calibration.procedure.removeStep" }),
    );

    // The contract refuses an empty verify phase, so the last removal drops the phase.
    expect(zCaptureProcedure.safeParse(onChange.mock.calls.at(-1)?.[0]).success).toBe(true);
    expect(onChange.mock.calls.at(-1)?.[0].verify).toBeUndefined();
  });
});
