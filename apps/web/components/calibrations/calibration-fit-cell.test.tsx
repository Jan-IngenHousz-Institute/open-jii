import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationFitCell } from "./calibration-fit-cell";

const SCHEMA = { blocks: { par: { slope: { type: "number" as const } } } };

function renderCell(props: Partial<Parameters<typeof CalibrationFitCell>[0]> = {}) {
  render(
    <CalibrationFitCell
      script={'submit({"par": {"status": "computed", "coefficients": {"slope": 1}}})'}
      outputSchema={SCHEMA}
      series={[]}
      family="minipar"
      canEdit
      onScriptChange={vi.fn()}
      onSchemaChange={vi.fn()}
      {...props}
    />,
  );
}

describe("CalibrationFitCell", () => {
  // Reading is about what a calibration needs and produces, not the Python that gets it
  // there: a closed definition opens with the script folded away.
  it("folds the script away on a definition nobody can edit", () => {
    renderCell({ canEdit: false });

    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    expect(screen.getByText("iot.calibration.fit.scriptLines")).toBeInTheDocument();
  });

  it("leaves the script open where it is the thing being worked on", () => {
    renderCell({ canEdit: true });

    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
  });

  it("opens the script on request", async () => {
    renderCell({ canEdit: false });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "iot.calibration.fit.scriptLines" }));

    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
  });
});
