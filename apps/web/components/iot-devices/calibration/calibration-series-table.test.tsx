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
  it("keeps a long reading whole in the row it sits in", () => {
    const channels = Array.from({ length: 10 }, (_, index) => index * 111);
    const settings = "model=AS7341,available=1,atime=100,astep=999,gain=2,led_ma=0";
    render(<CalibrationSeriesTable series="adpd_baseline" rows={[{ channels, settings }]} />);

    expect(screen.getByText(/^0, 111, 222/)).toBeInTheDocument();
    // Cutting the text down would put the reading itself out of reach of a copy or a
    // find, on the one page whose job is to hold the evidence.
    expect(screen.getByText(settings)).toHaveClass("truncate");
  });

  // Instruments and operators answer with more than numbers: a gate is a boolean, a
  // sensor's settings are text, and a compound setpoint is a record.
  it("renders every kind of cell a reading can hold", () => {
    render(
      <CalibrationSeriesTable
        series="spec_check"
        rows={[
          {
            spec: "AS7341,19,53",
            channels: [0.00785574, 0.00343847],
            dark: true,
            lamp: { current: 0.8, unit: "A" },
            par: 398.123456789,
          },
        ]}
      />,
    );

    expect(screen.getByText("AS7341,19,53")).toBeInTheDocument();
    expect(screen.getByText("0.00785574, 0.00343847")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("current: 0.8, unit: A")).toBeInTheDocument();
    expect(screen.getByText("398.123")).toBeInTheDocument();
  });

  it("renders nothing for a series with no points", () => {
    const { container } = render(<CalibrationSeriesTable series="empty" rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
