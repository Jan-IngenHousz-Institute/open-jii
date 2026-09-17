import { createCalibrationRun } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationRunsList } from "./calibration-runs-list";

const RUN_ID = "22222222-2222-4222-8222-222222222222";

describe("CalibrationRunsList", () => {
  // Every session on the list is a record someone may have to answer for, so each one
  // opens rather than only showing its verdict.
  it("opens the session that was clicked", async () => {
    const onSelectRun = vi.fn();
    render(
      <CalibrationRunsList
        runs={[createCalibrationRun({ id: RUN_ID, status: "approved" })]}
        isLoading={false}
        isError={false}
        onSelectRun={onSelectRun}
      />,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onSelectRun).toHaveBeenCalledWith(RUN_ID);
  });

  it("shows a failed session's error", () => {
    render(
      <CalibrationRunsList
        runs={[
          createCalibrationRun({
            status: "compute_failed",
            errorMessage: "channel readings are too close to collinear",
          }),
        ]}
        isLoading={false}
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByText(/too close to collinear/)).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.status.compute_failed")).toBeInTheDocument();
  });

  it("offers nothing to open while loading, on failure, or with no sessions", () => {
    const { rerender } = render(
      <CalibrationRunsList runs={undefined} isLoading isError={false} onSelectRun={vi.fn()} />,
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <CalibrationRunsList runs={undefined} isLoading={false} isError onSelectRun={vi.fn()} />,
    );
    expect(screen.getByText("iot.calibration.loadError")).toBeInTheDocument();

    rerender(
      <CalibrationRunsList runs={[]} isLoading={false} isError={false} onSelectRun={vi.fn()} />,
    );
    expect(screen.getByText("iot.calibration.runs.empty")).toBeInTheDocument();
  });
});
