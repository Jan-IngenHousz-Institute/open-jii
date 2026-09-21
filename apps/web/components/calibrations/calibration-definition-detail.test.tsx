import { createCalibrationDefinitionDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { AutosaveIndicator } from "../shared/autosave/autosave-indicator";
import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { CalibrationDefinitionDetail } from "./calibration-definition-detail";

/** The page as its layout composes it: the indicator reads what the detail reports. */
function renderDetail() {
  render(
    <AutosaveStatusProvider>
      <AutosaveIndicator />
      <CalibrationDefinitionDetail />
    </AutosaveStatusProvider>,
  );
}

const definition = createCalibrationDefinitionDetail({
  name: "PAR bench",
  captureProcedure: {
    instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" }],
    steps: [{ kind: "set", instrument: "lamp", set: "current_a", value: 0 }],
  },
});

function mountDefinition() {
  server.mount(contract.iot.getCalibrationDefinition, { body: definition });
  return server.mount(contract.iot.updateCalibrationDefinition, { body: definition });
}

function rowFor(value: string) {
  const row = screen
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByDisplayValue(value) !== null);
  if (!row) {
    throw new Error(`No row for ${value}`);
  }
  return row;
}

describe("CalibrationDefinitionDetail", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ locale: "en-US", definitionId: definition.id });
  });

  // The rig, the schema and the script are one document: a rename that reaches into the
  // steps cannot be half saved, so the page sends all three together.
  it("saves the whole document when one part of it changes", async () => {
    const update = mountDefinition();
    renderDetail();
    await screen.findByText("iot.calibration.detail.rig");

    const slope = within(rowFor("slope")).getByLabelText("iot.calibration.produces.max");
    await userEvent.clear(slope);
    await userEvent.type(slope, "12");

    expect(await screen.findByText("autosave.saved")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(update.body).toMatchObject({
          outputSchema: { blocks: { par: { slope: { max: 12 } } } },
          captureProcedure: definition.captureProcedure,
          script: definition.script,
        });
      },
      { timeout: 3000 },
    );
  });

  // An author is briefly between two valid documents on almost every keystroke; one that
  // stays refused would otherwise leave them editing over a draft that never lands.
  it("says why it is not saving, and does not save", async () => {
    const update = mountDefinition();
    renderDetail();
    await screen.findByText("iot.calibration.detail.rig");

    // The rig is a strip of instruments now; a role's details open from its chip.
    await userEvent.click(screen.getByRole("button", { name: /lamp/ }));
    await userEvent.clear(await screen.findByDisplayValue("KIPRIM"));

    expect(await screen.findByText("iot.calibration.detail.notSaving")).toBeInTheDocument();
    expect(screen.getByText(/captureProcedure.instruments/)).toBeInTheDocument();
    // "All changes saved" beside an alert saying it is not saving is the worst of both.
    expect(screen.queryByText("autosave.saved")).toBeNull();
    expect(screen.queryByText("autosave.saving")).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(update.called).toBe(false);
  });

  it("offers nothing to change to a reader", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: {
        ...definition,
        capabilities: { ...definition.capabilities, canUpdate: false },
      },
    });

    renderDetail();

    expect(await screen.findByText("iot.calibration.detail.readOnly")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /iot.calibration.rig.add/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /lamp/ }));
    expect(await screen.findByDisplayValue("KIPRIM")).toBeDisabled();
  });

  // The server refuses the save outright. Offering every field and then failing once, at
  // the save, is how an author loses an afternoon's edits.
  it("closes a definition a run already points at", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: { ...definition, runCount: 2 },
    });

    renderDetail();

    expect(await screen.findByText("iot.calibration.detail.frozen")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.detail.readOnly")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /lamp/ }));
    expect(await screen.findByDisplayValue("KIPRIM")).toBeDisabled();
  });

  // Rendered open, a procedure nobody can edit is a page of greyed-out fields.
  it("opens a closed procedure as a list of its steps", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: { ...definition, runCount: 2 },
    });

    renderDetail();

    expect(await screen.findByTestId("step-label")).toBeInTheDocument();
    expect(screen.queryByLabelText("iot.calibration.procedure.instrument")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "iot.calibration.procedure.expandStep" }),
    );

    expect(screen.getByLabelText("iot.calibration.procedure.instrument")).toBeDisabled();
  });
});
