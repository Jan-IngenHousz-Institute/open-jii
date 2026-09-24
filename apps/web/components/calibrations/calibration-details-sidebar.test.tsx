import { createCalibrationDefinitionDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { CalibrationDetailsSidebar } from "./calibration-details-sidebar";

function renderSidebar(definition = createCalibrationDefinitionDetail()) {
  render(<CalibrationDetailsSidebar definitionId={definition.id} definition={definition} />);
}

describe("CalibrationDetailsSidebar", () => {
  // A calibration method is worth more to the institute the further it travels, so it
  // carries the same owner and publish controls every other shared resource has.
  it("says who owns it and offers publishing", () => {
    renderSidebar(
      createCalibrationDefinitionDetail({
        organizationId: crypto.randomUUID(),
        organizationName: "Plant Physiology",
        visibility: "private",
      }),
    );

    expect(screen.getByText("Plant Physiology")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "resourceVisibility.statusLabel" })).toBeEnabled();
  });

  it("locks publishing for someone who cannot manage it", () => {
    renderSidebar(createCalibrationDefinitionDetail({ capabilities: readOnlyCapabilities }));

    expect(screen.getByRole("combobox", { name: "resourceVisibility.statusLabel" })).toBeDisabled();
  });

  it("names the calibration by its id and keeps the family and the firmware floor editable", () => {
    const definition = createCalibrationDefinitionDetail({ minFirmwareVersion: "1.03" });
    renderSidebar(definition);

    expect(screen.getByText(definition.id)).toBeInTheDocument();
    expect(screen.getByDisplayValue("1.03")).toBeEnabled();
    expect(screen.getByLabelText("iot.calibration.sidebar.family")).toBeInTheDocument();
  });

  it("saves the family, which decides what the rest of the document is checked against", async () => {
    const definition = createCalibrationDefinitionDetail({ family: "minipar" });
    const updateSpy = server.mount(contract.iot.updateCalibrationDefinition, {
      body: { ...definition, family: "ambit" },
    });
    renderSidebar(definition);

    await userEvent.click(screen.getByLabelText("iot.calibration.sidebar.family"));
    await userEvent.click(await screen.findByRole("option", { name: /ambit/i }));

    await waitFor(() => {
      expect(updateSpy.called).toBe(true);
    });
    expect(updateSpy.body).toMatchObject({ family: "ambit" });
  });

  it("saves a firmware floor once the author leaves the field", async () => {
    const definition = createCalibrationDefinitionDetail({ minFirmwareVersion: null });
    const updateSpy = server.mount(contract.iot.updateCalibrationDefinition, {
      body: { ...definition, minFirmwareVersion: "1.1.3" },
    });
    renderSidebar(definition);

    await userEvent.type(screen.getByLabelText("iot.calibration.sidebar.firmware"), "1.1.3");
    await userEvent.tab();

    await waitFor(() => {
      expect(updateSpy.called).toBe(true);
    });
    expect(updateSpy.body).toMatchObject({ minFirmwareVersion: "1.1.3" });
  });

  // Families disagree on shape, but "1.03.x" is no family's version, and saving it would
  // gate every run against a floor no firmware can clear.
  it("refuses a firmware floor that is not a version, and saves nothing", async () => {
    const definition = createCalibrationDefinitionDetail({ minFirmwareVersion: null });
    const updateSpy = server.mount(contract.iot.updateCalibrationDefinition, { body: definition });
    renderSidebar(definition);

    const field = screen.getByLabelText("iot.calibration.sidebar.firmware");
    await userEvent.type(field, "1.03.x");
    await userEvent.tab();

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("iot.calibration.sidebar.firmwareInvalid")).toBeInTheDocument();
    expect(updateSpy.called).toBe(false);
  });

  it("clears the floor rather than saving an empty version", async () => {
    const definition = createCalibrationDefinitionDetail({ minFirmwareVersion: "1.03" });
    const updateSpy = server.mount(contract.iot.updateCalibrationDefinition, {
      body: { ...definition, minFirmwareVersion: null },
    });
    renderSidebar(definition);

    await userEvent.clear(screen.getByLabelText("iot.calibration.sidebar.firmware"));
    await userEvent.tab();

    await waitFor(() => {
      expect(updateSpy.called).toBe(true);
    });
    expect(updateSpy.body).toMatchObject({ minFirmwareVersion: null });
  });

  // The server refuses every edit once a run points at the definition, so a field that
  // looked editable would only end in an error.
  it("reads the family and the firmware floor as text once runs have closed it", () => {
    renderSidebar(createCalibrationDefinitionDetail({ runCount: 3, minFirmwareVersion: "1.03" }));

    expect(screen.queryByRole("combobox", { name: "iot.calibration.sidebar.family" })).toBeNull();
    expect(screen.queryByDisplayValue("1.03")).toBeNull();
    expect(screen.getByText("1.03")).toBeInTheDocument();
  });

  it("says how long a run waits on itself, and that the operator's steps come on top", () => {
    const definition = createCalibrationDefinitionDetail();
    renderSidebar({
      ...definition,
      captureProcedure: {
        instruments: [{ role: "dut" }],
        steps: [
          { kind: "operator", prompt: "Cover the sensor" },
          { kind: "settle", ms: 1500 },
        ],
        verify: [{ kind: "settle", ms: 500 }],
      },
    });

    expect(screen.getByText("iot.calibration.sidebar.waiting")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.sidebar.waitingValueOperator")).toBeInTheDocument();
  });

  it("gives the waiting alone when no step stops for the operator", () => {
    const definition = createCalibrationDefinitionDetail();
    renderSidebar({
      ...definition,
      captureProcedure: { instruments: [{ role: "dut" }], steps: [{ kind: "settle", ms: 1500 }] },
    });

    expect(screen.getByText("iot.calibration.sidebar.waitingValue")).toBeInTheDocument();
  });
});
