import { createCalibrationRun } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationRunsList } from "./calibration-runs-list";

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const DEFINITION_ID = "33333333-3333-4333-8333-333333333333";

const NO_NAMES = new Map<string, string>();

describe("CalibrationRunsList", () => {
  // Every session on the list is a record someone may have to answer for, so each one
  // opens rather than only showing its verdict.
  it("opens the session that was clicked", async () => {
    const onSelectRun = vi.fn();
    render(
      <CalibrationRunsList
        runs={[createCalibrationRun({ id: RUN_ID, status: "approved" })]}
        definitionNames={NO_NAMES}
        isLoading={false}
        isError={false}
        onSelectRun={onSelectRun}
      />,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onSelectRun).toHaveBeenCalledWith(RUN_ID);
  });

  // A session is the record of one procedure; the row says which, and admits one whose
  // procedure is no longer listed.
  it("names each session's procedure, or says it is unknown", () => {
    render(
      <CalibrationRunsList
        runs={[
          createCalibrationRun({ definitionId: DEFINITION_ID, definitionVersion: 2 }),
          createCalibrationRun(),
        ]}
        definitionNames={new Map([[DEFINITION_ID, "MiniPAR bench"]])}
        isLoading={false}
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByText("MiniPAR bench")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.run.definitionUnknown")).toBeInTheDocument();
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
        definitionNames={NO_NAMES}
        isLoading={false}
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByText(/too close to collinear/)).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.status.compute_failed")).toBeInTheDocument();
  });

  // A bench unit collects sessions for years, and the panel beside it holds only the
  // coefficients in force.
  it("keeps a long history inside the panel", () => {
    render(
      <CalibrationRunsList
        runs={Array.from({ length: 30 }, () => createCalibrationRun())}
        definitionNames={NO_NAMES}
        isLoading={false}
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );

    const list = screen.getAllByRole("listitem")[0].parentElement;
    expect(list).toHaveClass("max-h-96", "overflow-y-auto");
  });

  it("seats the action it is given in its header", () => {
    render(
      <CalibrationRunsList
        runs={[]}
        definitionNames={NO_NAMES}
        isLoading={false}
        isError={false}
        action={<button type="button">Calibrate</button>}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Calibrate" })).toBeInTheDocument();
  });

  it("offers nothing to open while loading, on failure, or with no sessions", () => {
    const { rerender } = render(
      <CalibrationRunsList
        runs={undefined}
        definitionNames={NO_NAMES}
        isLoading
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <CalibrationRunsList
        runs={undefined}
        definitionNames={NO_NAMES}
        isLoading={false}
        isError
        onSelectRun={vi.fn()}
      />,
    );
    expect(screen.getByText("iot.calibration.loadError")).toBeInTheDocument();

    rerender(
      <CalibrationRunsList
        runs={[]}
        definitionNames={NO_NAMES}
        isLoading={false}
        isError={false}
        onSelectRun={vi.fn()}
      />,
    );
    expect(screen.getByText("iot.calibration.runs.empty")).toBeInTheDocument();
  });
});
