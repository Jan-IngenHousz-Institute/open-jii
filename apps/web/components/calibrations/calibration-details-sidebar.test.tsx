import { createCalibrationDefinitionDetail, readOnlyCapabilities } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

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
});
