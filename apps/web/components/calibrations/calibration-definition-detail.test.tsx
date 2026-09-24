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

// A sweep draws its points, and Plotly has no business in jsdom. Mocked at the wrapper,
// because that is where the dynamic import happens.
vi.mock("@/components/charts/scatter-chart", () => ({
  ScatterChart: () => <div data-testid="scatter" />,
}));

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
  // A token's accessible name is the field it edits; its text is the value.
  const row = screen
    .getAllByRole("listitem")
    .find((candidate) => candidate.textContent.includes(value));
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

    await userEvent.click(
      within(rowFor("slope")).getByRole("button", { name: "iot.calibration.produces.max" }),
    );
    const slope = within(rowFor("slope")).getByRole("textbox", {
      name: "iot.calibration.produces.max",
    });
    await userEvent.clear(slope);
    await userEvent.type(slope, "12");
    await userEvent.tab();

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

    // The rig is a line per instrument; a handshake is a value in it.
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.rig.handshake" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "iot.calibration.rig.handshake" }));
    await userEvent.tab();

    expect(await screen.findByText("iot.calibration.detail.notSaving")).toBeInTheDocument();
    // Placed the way the page names it, not as a schema path.
    expect(screen.getByText(/^iot\.calibration\.detail\.rig, /)).toBeInTheDocument();
    expect(screen.queryByText(/captureProcedure/)).toBeNull();
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

    // Nothing on the page is a control: every value is text.
    expect(screen.queryByRole("button", { name: "iot.calibration.rig.handshake" })).toBeNull();
    expect(screen.getByText("KIPRIM")).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "iot.calibration.rig.handshake" })).toBeNull();
    expect(screen.getByText("KIPRIM")).toBeInTheDocument();
  });

  // A closed procedure is read, so it is the sentences and nothing to click.
  it("reads a closed procedure as its steps, with nothing to change", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: { ...definition, runCount: 2 },
    });

    renderDetail();

    await screen.findByText("iot.calibration.detail.frozen");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "iot.calibration.procedure.addStep" })).toBeNull();
    expect(screen.queryByRole("button", { name: "iot.calibration.procedure.values" })).toBeNull();
  });
});
