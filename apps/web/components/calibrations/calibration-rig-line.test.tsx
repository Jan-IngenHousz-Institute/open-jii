import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BenchInstrumentSummary } from "@repo/iot";

import { CalibrationRigLine } from "./calibration-rig-line";
import type { AuxiliaryInstrument } from "./procedure-edits";
import type { SetpointOption } from "./rig-sources";

const INSTRUMENTS: BenchInstrumentSummary[] = [
  {
    model: "kiprim-dc",
    identityToken: "KIPRIM",
    setpoints: [{ name: "current_a", unit: "A", min: 0, max: 10 }],
    readings: [{ name: "current_a", unit: "A" }],
  },
  {
    model: "minipar-reference",
    identityToken: "Par_REF",
    setpoints: [],
    readings: [{ name: "par", unit: "umol/m2/s" }],
  },
];

function instrument(overrides: Partial<AuxiliaryInstrument> = {}): AuxiliaryInstrument {
  return { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc", ...overrides };
}

const DRIVES: SetpointOption[] = [
  { name: "current_a", unit: "A", min: 0, max: 10, integer: false },
];

function renderLine(props: Partial<Parameters<typeof CalibrationRigLine>[0]> = {}) {
  const onChange = vi.fn();
  const onRename = vi.fn();
  const onRemove = vi.fn();
  const { container } = render(
    <CalibrationRigLine
      instrument={instrument()}
      instruments={INSTRUMENTS}
      takenRoles={["lamp"]}
      usedBySteps={0}
      setpoints={[]}
      readings={[]}
      canEdit
      onChange={onChange}
      onRename={onRename}
      onRemove={onRemove}
      {...props}
    />,
  );
  return {
    container,
    onChange,
    onRename,
    onRemove,
    user: userEvent.setup({ pointerEventsCheck: 0 }),
  };
}

describe("CalibrationRigLine", () => {
  it("renames the role the steps address this instrument by", async () => {
    const { onRename, user } = renderLine();

    await user.click(screen.getByRole("button", { name: "iot.calibration.rig.role" }));
    const role = screen.getByRole("textbox", { name: "iot.calibration.rig.role" });
    await user.clear(role);
    await user.type(role, "source");
    await user.tab();

    expect(onRename).toHaveBeenLastCalledWith("source");
  });

  // Validity is the document's to judge, not the field's: a role already taken elsewhere
  // in the rig is marked from the props the parent computed, not from a local guess.
  // takenRoles carries every instrument's role, so a real collision means "par_ref"
  // appears twice: once for this row, once for the other instrument that has it too.
  it("marks a role the rig already holds elsewhere as invalid", () => {
    renderLine({
      instrument: instrument({ role: "par_ref" }),
      takenRoles: ["par_ref", "par_ref"],
    });

    expect(screen.getByRole("button", { name: "iot.calibration.rig.role" })).toHaveClass(
      "text-destructive",
    );
  });

  // Collision-checking happens where the document is judged as a whole, not in this line:
  // the call reaches the parent, whose renameInstrumentRole a schema failure would reject.
  it("reports a role typed over one the rig already holds, for the parent to judge", async () => {
    const { onRename, user } = renderLine({ takenRoles: ["lamp", "par_ref"] });

    await user.click(screen.getByRole("button", { name: "iot.calibration.rig.role" }));
    const role = screen.getByRole("textbox", { name: "iot.calibration.rig.role" });
    await user.clear(role);
    await user.type(role, "par_ref");
    await user.tab();

    expect(onRename).toHaveBeenLastCalledWith("par_ref");
  });

  // A handshake that only ever named the old model is not worth keeping past it.
  it("takes the new model's handshake when the old one was the model's own", async () => {
    const { onChange, user } = renderLine();

    await user.click(screen.getByRole("combobox", { name: "iot.calibration.rig.instrument" }));
    await user.click(await screen.findByRole("option", { name: "minipar-reference" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: "minipar-reference", handshake: "Par_REF" }),
    );
  });

  it("keeps a handshake the author typed to tell two units of a model apart", async () => {
    const { onChange, user } = renderLine({ instrument: instrument({ handshake: "Par_REF_2" }) });

    await user.click(screen.getByRole("combobox", { name: "iot.calibration.rig.instrument" }));
    await user.click(await screen.findByRole("option", { name: "minipar-reference" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ handshake: "Par_REF_2" }));
  });

  it("marks an empty handshake, since nothing can be bound to a role that answers to nothing", () => {
    renderLine({ instrument: instrument({ handshake: "" }) });

    expect(screen.getByRole("button", { name: "iot.calibration.rig.handshake" })).toHaveClass(
      "text-destructive",
    );
  });

  // The two clauses read as one sentence continuing what came before, joined by "and"
  // rather than glued on with a middot.
  it("reads what a role drives and what it answers as prose", () => {
    const { container } = renderLine({
      setpoints: DRIVES,
      readings: ["temperature_c"],
    });

    expect(container.querySelector("p")).toHaveTextContent(
      "kiprim-dc iot.calibration.rig.answeringTo KIPRIM, iot.calibration.rig.drives " +
        "current_a 0\u2060…\u206010 A iot.calibration.produces.and iot.calibration.rig.answers " +
        "temperature_c",
    );
  });

  it("says nothing about driving or answering when a role does neither", () => {
    renderLine();

    expect(screen.queryByText("iot.calibration.rig.drives")).toBeNull();
    expect(screen.queryByText("iot.calibration.rig.answers")).toBeNull();
  });

  it("holds a role the steps still name", () => {
    renderLine({ usedBySteps: 2 });

    const remove = screen.getByRole("button", { name: "iot.calibration.rig.remove" });
    expect(remove).toBeDisabled();
  });

  it("offers no controls on a definition a run has closed", () => {
    renderLine({ canEdit: false });

    expect(screen.queryByRole("button", { name: "iot.calibration.rig.role" })).toBeNull();
    expect(screen.queryByRole("button", { name: "iot.calibration.rig.instrument" })).toBeNull();
    expect(screen.getByText("lamp")).toBeInTheDocument();
  });
});
