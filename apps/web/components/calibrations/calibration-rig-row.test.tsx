import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BenchInstrumentSummary } from "@repo/iot";

import { CalibrationRigRow } from "./calibration-rig-row";
import type { AuxiliaryInstrument } from "./procedure-edits";

const INSTRUMENTS: BenchInstrumentSummary[] = [
  {
    model: "Kiprim DC310S",
    identityToken: "KIPRIM",
    setpoints: [{ name: "current_a", unit: "A", min: 0, max: 6.6 }],
    readings: [{ name: "current_a", unit: "A" }],
  },
  {
    model: "MicroPython PAR",
    identityToken: "UPYPAR",
    setpoints: [],
    readings: [{ name: "par", unit: "umol/m2/s" }],
  },
];

function instrument(overrides: Partial<AuxiliaryInstrument> = {}): AuxiliaryInstrument {
  return { role: "lamp", handshake: "KIPRIM", model: "Kiprim DC310S", ...overrides };
}

function renderRow(props: Partial<Parameters<typeof CalibrationRigRow>[0]> = {}) {
  const onChange = vi.fn();
  const onRename = vi.fn();
  const onRemove = vi.fn();
  render(
    <CalibrationRigRow
      instrument={instrument()}
      instruments={INSTRUMENTS}
      takenRoles={["lamp"]}
      usedBySteps={0}
      canEdit
      onChange={onChange}
      onRename={onRename}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onChange, onRename, onRemove };
}

describe("CalibrationRigRow", () => {
  it("renames the role the steps address this instrument by", async () => {
    const { onRename } = renderRow();

    const role = screen.getByLabelText("iot.calibration.rig.role");
    await userEvent.clear(role);
    await userEvent.type(role, "source");

    expect(onRename).toHaveBeenLastCalledWith("source");
  });

  // A rename passing through another role's name would otherwise take that role's steps.
  it("refuses a role the rig already holds", async () => {
    const { onRename } = renderRow({ takenRoles: ["lamp", "par_ref"] });

    const role = screen.getByLabelText("iot.calibration.rig.role");
    await userEvent.clear(role);
    await userEvent.type(role, "par_ref");

    expect(screen.getByText("iot.calibration.rig.roleTaken")).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalledWith("par_ref");
  });

  it("refuses a role that is not a payload key, and puts the saved one back", async () => {
    const { onRename } = renderRow();

    const role = screen.getByLabelText("iot.calibration.rig.role");
    await userEvent.clear(role);
    await userEvent.type(role, "1lamp");
    expect(screen.getByText("iot.calibration.rig.roleInvalid")).toBeInTheDocument();

    await userEvent.tab();
    expect(role).toHaveValue("lamp");
    expect(onRename).not.toHaveBeenCalledWith("1lamp");
  });

  // A handshake that only ever named the old model is not worth keeping past it.
  it("takes the new model's handshake when the old one was the model's own", async () => {
    const { onChange } = renderRow();

    await userEvent.click(screen.getByLabelText("iot.calibration.rig.instrument"));
    await userEvent.click(await screen.findByRole("option", { name: "MicroPython PAR" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: "MicroPython PAR", handshake: "UPYPAR" }),
    );
  });

  it("keeps a handshake the author typed to tell two units of a model apart", async () => {
    const { onChange } = renderRow({ instrument: instrument({ handshake: "Par_REF_2" }) });

    await userEvent.click(screen.getByLabelText("iot.calibration.rig.instrument"));
    await userEvent.click(await screen.findByRole("option", { name: "MicroPython PAR" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ handshake: "Par_REF_2" }));
  });

  it("holds a role the steps still name", () => {
    renderRow({ usedBySteps: 2 });

    expect(screen.getByRole("button", { name: "iot.calibration.rig.remove" })).toBeDisabled();
  });
});
