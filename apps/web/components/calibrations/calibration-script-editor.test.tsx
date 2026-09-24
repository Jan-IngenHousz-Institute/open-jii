import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CalibrationScriptEditor } from "./calibration-script-editor";

describe("CalibrationScriptEditor", () => {
  // Tab indents Python, so the way out of the editor has to be said.
  it("tells an author how to leave the script by keyboard", () => {
    render(<CalibrationScriptEditor script="submit({})" canEdit onChange={vi.fn()} />);

    expect(screen.getByText("iot.calibration.fit.leaveEditor")).toBeInTheDocument();
  });

  it("says nothing about leaving a script nobody can type into", () => {
    render(<CalibrationScriptEditor script="submit({})" canEdit={false} onChange={vi.fn()} />);

    expect(screen.queryByText("iot.calibration.fit.leaveEditor")).toBeNull();
  });
});
