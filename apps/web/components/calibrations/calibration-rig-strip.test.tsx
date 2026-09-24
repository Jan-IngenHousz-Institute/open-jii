import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { benchInstrumentSummaries } from "@repo/iot";

import { CalibrationRigStrip } from "./calibration-rig-strip";

const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [],
};

function renderStrip(props: Partial<Parameters<typeof CalibrationRigStrip>[0]> = {}) {
  const onChange = vi.fn<(procedure: CaptureProcedure) => void>();
  render(
    <CalibrationRigStrip
      procedure={PROCEDURE}
      family="minipar"
      canEdit
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("CalibrationRigStrip", () => {
  it("shows the device under test, which every rig declares", () => {
    renderStrip();

    expect(screen.getByText("dut")).toBeInTheDocument();
  });

  // A role becomes a payload key and the steps address it by name, so an added instrument
  // has to arrive under a name nothing else holds.
  it("adds an instrument under its model's name and its own handshake", async () => {
    const first = benchInstrumentSummaries()[0];
    const { onChange } = renderStrip();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.rig.add" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: new RegExp(first.model) }));

    const added = onChange.mock.calls.at(-1)?.[0].instruments.at(-1);
    expect(added).toMatchObject({ model: first.model, handshake: first.identityToken });
  });

  it("numbers a second unit of the same model rather than colliding with the first", async () => {
    const first = benchInstrumentSummaries()[0];
    const role = first.model.replace(/-/g, "_");
    const { onChange } = renderStrip({
      procedure: {
        instruments: [
          { role: "dut" },
          { role, handshake: first.identityToken, model: first.model },
        ],
        steps: [],
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.rig.add" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: new RegExp(first.model) }));

    expect(onChange.mock.calls.at(-1)?.[0].instruments.at(-1)?.role).toBe(`${role}_2`);
  });

  it("offers nothing to add on a definition a run has closed", () => {
    renderStrip({ canEdit: false });

    expect(screen.queryByRole("button", { name: "iot.calibration.rig.add" })).toBeNull();
  });

  // A model id says nothing to a first-time author; a supply and a reference look alike.
  it("says what each instrument is for, and counts the channels it leaves out", async () => {
    renderStrip();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.rig.add" }));

    expect(await screen.findByText("iot.calibration.rig.purpose.kiprim-dc")).toBeInTheDocument();
    const board = screen.getByRole("menuitem", { name: /calitool-spectral-board/ });
    expect(board).toHaveTextContent("iot.calibration.rig.andMore");
  });
});
