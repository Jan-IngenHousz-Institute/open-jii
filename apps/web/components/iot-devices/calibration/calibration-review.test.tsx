import { createCalibrationRun, createDeviceCalibration } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationReview } from "./calibration-review";

vi.mock("./calibration-fit-chart", () => ({
  CalibrationFitChart: ({ slope, intercept }: { slope: number; intercept: number }) => (
    <div data-testid="fit-chart">{`${slope}|${intercept}`}</div>
  ),
}));

const PAYLOAD = {
  par_sweep: [
    { stimulus: "bright", par_raw: 420, par_ref: 402.12 },
    { stimulus: "medium", par_raw: 150, par_ref: 142.92 },
    { stimulus: "dim", par_raw: 8.33, par_ref: 6.92 },
  ],
};

function renderReview(overrides: Partial<Parameters<typeof CalibrationReview>[0]> = {}) {
  const props = {
    run: createCalibrationRun(),
    payload: PAYLOAD,
    active: null,
    isApproving: false,
    isRejecting: false,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    ...overrides,
  };
  render(<CalibrationReview {...props} />);
  return props;
}

describe("CalibrationReview", () => {
  it("shows each computed block with its new coefficients and quality", () => {
    renderReview();

    expect(screen.getByText("par")).toBeInTheDocument();
    expect(screen.getByText("0.96")).toBeInTheDocument();
    expect(screen.getByText("-1.08")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.review.passed")).toBeInTheDocument();
  });

  // The old-versus-new comparison is the reviewer's main evidence.
  it("shows the coefficients currently in force beside the new ones", () => {
    renderReview({
      active: createDeviceCalibration({
        blocks: { par: { coefficients: { slope: 0.91, intercept: -0.5 } } },
      }),
    });

    expect(screen.getByText("0.91")).toBeInTheDocument();
    expect(screen.getByText("-0.5")).toBeInTheDocument();
  });

  it("says the previous coefficient is unknown when nothing is in force", () => {
    renderReview();

    expect(screen.getAllByText("iot.calibration.review.previousUnknown")).toHaveLength(2);
  });

  it("plots the captured points against the fitted line", () => {
    renderReview();

    expect(screen.getByTestId("fit-chart")).toHaveTextContent("0.96|-1.08");
  });

  it("approves and rejects through the callbacks", async () => {
    const props = renderReview();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.review.approve" }));
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.review.reject" }));

    expect(props.onApprove).toHaveBeenCalledTimes(1);
    expect(props.onReject).toHaveBeenCalledTimes(1);
  });

  it("offers no decision on a run that did not compute", () => {
    renderReview({
      run: createCalibrationRun({
        status: "compute_failed",
        blocks: null,
        errorMessage: "Coefficient 'par.slope' is above the allowed maximum",
      }),
    });

    expect(screen.getByText("iot.calibration.review.computeFailed")).toBeInTheDocument();
    expect(screen.getByText(/above the allowed maximum/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.review.approve" })).toBeNull();
  });

  // When every block was rejected, the run fails as a whole but each block's
  // reason is the part the reviewer needs; withholding it would leave "failed".
  it("still shows each block's reason when the run did not compute", () => {
    renderReview({
      run: createCalibrationRun({
        status: "compute_failed",
        errorMessage: "No block produced coefficients",
        blocks: {
          par: { status: "rejected", reason: "at least three calibration points are required" },
        },
      }),
    });

    expect(screen.getByText("at least three calibration points are required")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.block.rejected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.review.reject" })).toBeNull();
  });

  it("shows a rejected block's reason without coefficients", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: { par: { status: "rejected", reason: "R-squared below 0.99" } },
      }),
    });

    expect(screen.getByText("R-squared below 0.99")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.block.rejected")).toBeInTheDocument();
    expect(screen.queryByTestId("fit-chart")).toBeNull();
  });
});
