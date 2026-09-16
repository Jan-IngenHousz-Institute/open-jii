import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalibrationSeriesTable } from "./calibration-series-table";

describe("CalibrationSeriesTable", () => {
  it("shows every captured point with the setpoint that produced it", () => {
    render(
      <CalibrationSeriesTable
        series="par_sweep"
        rows={[
          { stimulus: 0.8, par_raw: 208.4, par_ref: 200 },
          { stimulus: 2.4, par_raw: 625.2, par_ref: 600 },
        ]}
      />,
    );

    expect(screen.getByText("iot.calibration.review.seriesCaption")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    // One header row plus one per point.
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("0.8")).toBeInTheDocument();
    expect(within(rows[1]).getByText("208.4")).toBeInTheDocument();
    expect(within(rows[2]).getByText("600")).toBeInTheDocument();
  });

  // The setpoint is what a reader scans down, so it leads whatever order the columns
  // arrived in.
  it("puts the setpoint first", () => {
    render(<CalibrationSeriesTable series="led_sweep" rows={[{ emit_ref: 41.5, stimulus: 10 }]} />);

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["stimulus", "emit_ref"]);
  });

  // A device that answers a structured reading lands it whole in one cell, and a reviewer
  // still has to be able to read the row it sits in.
  it("renders a structured reading without pushing the row apart", () => {
    const channels = Array.from({ length: 10 }, (_, index) => index * 111);
    render(
      <CalibrationSeriesTable
        series="adpd_baseline"
        rows={[{ channels, note: "x".repeat(120) }]}
      />,
    );

    expect(screen.getByText(/^0, 111, 222/)).toBeInTheDocument();
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it("renders nothing for a series with no points", () => {
    const { container } = render(<CalibrationSeriesTable series="empty" rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
