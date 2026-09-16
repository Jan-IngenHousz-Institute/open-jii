import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { CalibrationRigEditor } from "./calibration-rig-editor";

const procedure: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
    { role: "spare", handshake: "CaliTool", model: "calitool-spectral-board" },
  ],
  steps: [
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
    {
      kind: "read",
      series: "reading",
      read: [{ instrument: "dut", command: "get_par", as: "par" }],
    },
  ],
};

/** The page holds the document and hands it back, so an edit has to round-trip to show. */
function Host({ onChange }: { onChange: (next: CaptureProcedure) => void }) {
  const [edited, setEdited] = useState(procedure);

  return (
    <CalibrationRigEditor
      procedure={edited}
      family="minipar"
      canEdit
      onChange={(next) => {
        setEdited(next);
        onChange(next);
      }}
    />
  );
}

function renderEditor() {
  const onChange = vi.fn<(next: CaptureProcedure) => void>();
  render(<Host onChange={onChange} />);
  return { onChange, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

function rowFor(role: string) {
  const rows = screen.getAllByRole("listitem");
  const row = rows.find((candidate) => within(candidate).queryByDisplayValue(role) !== null);
  if (!row) {
    throw new Error(`No row for ${role}`);
  }
  return row;
}

describe("CalibrationRigEditor", () => {
  it("names what the device under test can be driven through", () => {
    renderEditor();

    // The MiniPAR drives no setpoints of its own; saying so is what stops an author
    // writing a set step against it.
    expect(screen.getByText("iot.calibration.rig.noDeviceSetpoints")).toBeInTheDocument();
  });

  it("says what the instrument a role names can do", () => {
    renderEditor();

    expect(within(rowFor("lamp")).getByText(/current_a/)).toBeInTheDocument();
    expect(within(rowFor("lamp")).getByText(/voltage_v/)).toBeInTheDocument();
  });

  // Nothing is typed that the registry already knows: a mistyped handshake is only
  // discovered when Connect refuses the port at the bench.
  it("adds an instrument from the registry, with the handshake it answers", async () => {
    const { onChange, user } = renderEditor();

    await user.click(screen.getByRole("button", { name: /iot.calibration.rig.add/ }));
    await user.click(await screen.findByRole("menuitem", { name: "minipar-reference" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0];
    expect(added.instruments.at(-1)).toEqual({
      role: "minipar_reference",
      handshake: "MiniPAR",
      model: "minipar-reference",
    });
  });

  it("renames the role in the steps that use it", async () => {
    const { onChange, user } = renderEditor();

    await user.type(within(rowFor("lamp")).getByDisplayValue("lamp"), "_a");

    const renamed = onChange.mock.calls.at(-1)?.[0];
    expect(renamed?.instruments[1]).toMatchObject({ role: "lamp_a" });
    expect(renamed?.steps[0]).toMatchObject({ instrument: "lamp_a" });
  });

  it("refuses a role another instrument already has", async () => {
    const { onChange, user } = renderEditor();

    const role = within(rowFor("spare")).getByDisplayValue("spare");
    await user.clear(role);
    await user.type(role, "lamp");

    expect(screen.getByText("iot.calibration.rig.roleTaken")).toBeInTheDocument();
    expect(onChange.mock.calls.every(([next]) => next.instruments[2].role !== "lamp")).toBe(true);
  });

  // An empty handshake stops the page saving, so the row has to say so rather than
  // leaving the author with changes that quietly never land.
  it("says why a row with no handshake blocks the save", async () => {
    const { user } = renderEditor();

    await user.clear(within(rowFor("spare")).getByDisplayValue("CaliTool"));

    expect(screen.getByText("iot.calibration.rig.handshakeRequired")).toBeInTheDocument();
  });

  // Removing a role the steps still name produces a procedure the contract refuses, and
  // the author would read the failure as being about whatever they edited next.
  it("will not remove a role the steps still name", () => {
    renderEditor();

    expect(
      within(rowFor("lamp")).getByRole("button", { name: "iot.calibration.rig.remove" }),
    ).toBeDisabled();
    expect(within(rowFor("lamp")).getByText("iot.calibration.rig.usedBy")).toBeInTheDocument();
  });

  it("removes one nothing names", async () => {
    const { onChange, user } = renderEditor();

    await user.click(
      within(rowFor("spare")).getByRole("button", { name: "iot.calibration.rig.remove" }),
    );

    const remaining = onChange.mock.calls[0][0];
    expect(remaining.instruments.map((instrument) => instrument.role)).toEqual(["dut", "lamp"]);
  });
});
