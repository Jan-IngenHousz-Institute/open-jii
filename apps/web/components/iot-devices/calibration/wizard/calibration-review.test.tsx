import { createActiveDeviceCalibration, createCalibrationRun } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CalibrationReview } from "./calibration-review";

// Plotly has no business in jsdom; the chart's own tests cover what it is given.
vi.mock("../result/calibration-block-chart", () => ({
  CalibrationBlockChart: ({ block }: { block: { coefficients?: Record<string, unknown> } }) => (
    <div data-testid="block-chart">{JSON.stringify(block.coefficients)}</div>
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
    ...overrides,
  };
  render(<CalibrationReview {...props} />);
  return props;
}

describe("CalibrationReview", () => {
  // Coefficients alone cannot show a reviewer a point that went wrong, and three of the
  // seeded procedures draw no chart at all, so the measured points are always on screen.
  it("shows the points the fit was drawn from", () => {
    renderReview();

    expect(screen.getByRole("table")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(PAYLOAD.par_sweep.length + 1);
    expect(screen.getByText("402.12")).toBeInTheDocument();
    expect(screen.getByText("8.33")).toBeInTheDocument();
  });

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
      active: createActiveDeviceCalibration({
        blocks: {
          par: {
            coefficients: { slope: 0.91, intercept: -0.5 },
            calibrationId: "33333333-3333-4333-8333-333333333333",
            runId: "44444444-4444-4444-8444-444444444444",
            validFrom: "2026-09-01T10:05:00.000Z",
            writtenToDeviceAt: null,
            writeResult: null,
          },
        },
      }),
    });

    expect(screen.getByText("0.91")).toBeInTheDocument();
    expect(screen.getByText("-0.5")).toBeInTheDocument();
    expect(screen.getAllByText("iot.calibration.review.previousLabel")).toHaveLength(2);
  });

  // A recalibration that lands on the number already in force is the common case, and
  // printing it twice buried the coefficients that did move.
  it("says a coefficient is unchanged instead of showing it twice", () => {
    renderReview({
      active: createActiveDeviceCalibration({
        blocks: {
          par: {
            coefficients: { slope: 0.96, intercept: -1.08 },
            calibrationId: "33333333-3333-4333-8333-333333333333",
            runId: "44444444-4444-4444-8444-444444444444",
            validFrom: "2026-09-01T10:05:00.000Z",
            writtenToDeviceAt: null,
            writeResult: null,
          },
        },
      }),
    });

    expect(screen.getAllByText("iot.calibration.review.unchanged")).toHaveLength(2);
    expect(screen.getAllByText("0.96")).toHaveLength(1);
  });

  it("says the previous coefficient is unknown when nothing is in force", () => {
    renderReview();

    expect(screen.getAllByText("iot.calibration.review.previousUnknown")).toHaveLength(2);
  });

  // The picture belongs beside the coefficients it justifies, one per block, rather than
  // as a single chart for the run picked out by convention.
  it("gives every block its own chart", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: {
          par: { status: "computed", coefficients: { slope: 0.96 } },
          baseline: { status: "computed", coefficients: { channels: [312, 198] } },
        },
      }),
    });

    const charts = screen.getAllByTestId("block-chart");
    expect(charts).toHaveLength(2);
    expect(charts[1]).toHaveTextContent('{"channels":[312,198]}');
  });

  // A ten-channel coefficient is one value, however many lines it wraps over.
  it("keeps a per-channel coefficient whole", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: {
          spec: {
            status: "computed",
            coefficients: { channel_coefficients: [-2.03393, 0.60675, 0.100565] },
          },
        },
      }),
    });

    expect(screen.getByText("[-2.03393, 0.60675, 0.100565]")).toBeInTheDocument();
    expect(screen.getByText("channel_coefficients")).toBeInTheDocument();
  });

  // R-squared says a fit is poor without saying which reading made it poor, which is the
  // one thing an operator can act on at the bench.
  it("names the reading furthest from the fit, by the setpoint that produced it", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: {
          par: {
            status: "computed",
            coefficients: { slope: 0.96 },
            quality: {
              passed: false,
              reasons: [],
              worst_index: 2,
              worst_stimulus: "dim",
              worst_residual_fraction: 0.1342,
            },
          },
        },
      }),
    });

    expect(screen.getByText("iot.calibration.review.worstPoint")).toBeInTheDocument();
  });

  // Saying "furthest reading" with nothing to name would send the operator looking for a
  // row that the record cannot identify.
  it("says nothing about a furthest reading when the fit named none", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: {
          par: {
            status: "computed",
            coefficients: { slope: 0.96 },
            quality: { passed: true, reasons: [], worst_index: null, worst_stimulus: null },
          },
        },
      }),
    });

    expect(screen.queryByText("iot.calibration.review.worstPoint")).toBeNull();
  });

  // A block can compute and still fail its own quality gates; the reviewer
  // needs the gate's reasons in front of the approve button.
  it("lists the quality reasons of a computed block that failed its gates", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: {
          par: {
            status: "computed",
            coefficients: { slope: 0.96, intercept: -1.08 },
            quality: { passed: false, reasons: ["R-squared must be at least 0.99"] },
          },
        },
      }),
    });

    expect(screen.getByText("iot.calibration.review.failed")).toBeInTheDocument();
    expect(screen.getByText("R-squared must be at least 0.99")).toBeInTheDocument();
  });

  it("explains a run that did not compute, with the readings it was given", () => {
    renderReview({
      run: createCalibrationRun({
        status: "compute_failed",
        blocks: null,
        errorMessage: "Coefficient 'par.slope' is above the allowed maximum",
      }),
    });

    expect(screen.getByText("iot.calibration.review.computeFailed")).toBeInTheDocument();
    expect(screen.getByText(/above the allowed maximum/)).toBeInTheDocument();
    expect(screen.getByText("402.12")).toBeInTheDocument();
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
  });

  it("shows a rejected block's reason without coefficients", () => {
    renderReview({
      run: createCalibrationRun({
        blocks: { par: { status: "rejected", reason: "R-squared below 0.99" } },
      }),
    });

    expect(screen.getByText("R-squared below 0.99")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.block.rejected")).toBeInTheDocument();
  });
});
