import type { AutosaveStatus } from "@/hooks/useAutosave";
import { createCalibrationDefinitionDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AutosaveStatusProvider,
  useReportAutosaveStatus,
} from "../shared/autosave/autosave-status-context";
import { CalibrationLayoutContent } from "./calibration-layout-content";

/** Stands for the document below the layout, which is what knows whether it is saving. */
function Body({ status }: { status: AutosaveStatus | null }) {
  useReportAutosaveStatus({ status, error: null });
  return <p>body</p>;
}

function renderLayout(runCount: number, status: AutosaveStatus | null = "idle") {
  const definition = createCalibrationDefinitionDetail({ name: "PAR bench", runCount });

  render(
    <AutosaveStatusProvider>
      <CalibrationLayoutContent
        definitionId={definition.id}
        definition={definition}
        showTabs={false}
      >
        <Body status={status} />
      </CalibrationLayoutContent>
    </AutosaveStatusProvider>,
  );
}

describe("CalibrationLayoutContent", () => {
  it("renames in place while nothing has run the definition", async () => {
    renderLayout(0);

    await userEvent.click(screen.getByText("PAR bench"));

    expect(screen.getByDisplayValue("PAR bench")).toBeInTheDocument();
    expect(screen.getByText("autosave.saved")).toBeInTheDocument();
  });

  // The server refuses every edit once a run points at the definition, and the name is an
  // edit like any other.
  it("will not rename a definition a run already points at", async () => {
    renderLayout(2);

    await userEvent.click(screen.getByText("PAR bench"));

    expect(screen.queryByDisplayValue("PAR bench")).toBeNull();
    // Nothing on the page saves, so reporting that everything is saved says nothing true.
    expect(screen.queryByText("autosave.saved")).toBeNull();
  });

  it("says nothing while the document below reports no save state", () => {
    // A draft that will not validate is not saving and is not saved.
    renderLayout(0, null);

    expect(screen.queryByText("autosave.saved")).toBeNull();
  });
});
