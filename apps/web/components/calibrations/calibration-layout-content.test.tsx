import { createCalibrationDefinitionDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AutosaveStatusProvider } from "../shared/autosave/autosave-status-context";
import { CalibrationLayoutContent } from "./calibration-layout-content";

function renderLayout(runCount: number) {
  const definition = createCalibrationDefinitionDetail({ name: "PAR bench", runCount });

  render(
    <AutosaveStatusProvider>
      <CalibrationLayoutContent
        definitionId={definition.id}
        definition={definition}
        showTabs={false}
      >
        <p>body</p>
      </CalibrationLayoutContent>
    </AutosaveStatusProvider>,
  );
}

describe("CalibrationLayoutContent", () => {
  it("renames in place while nothing has run the definition", async () => {
    renderLayout(0);

    await userEvent.click(screen.getByText("PAR bench"));

    expect(screen.getByDisplayValue("PAR bench")).toBeInTheDocument();
  });

  // The server refuses every edit once a run points at the definition, and the name is an
  // edit like any other.
  it("will not rename a definition a run already points at", async () => {
    renderLayout(2);

    await userEvent.click(screen.getByText("PAR bench"));

    expect(screen.queryByDisplayValue("PAR bench")).toBeNull();
  });
});
