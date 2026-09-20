import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
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

  // The setpoint leads, which the shared table would otherwise reorder by type.
  it("puts the setpoint first", () => {
    render(<CalibrationSeriesTable series="led_sweep" rows={[{ emit_ref: 41.5, stimulus: 10 }]} />);

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["stimulus", "emit_ref"]);
  });

  // The dark point of a baseline reads zero everywhere, and a blank cell there would look
  // like a reading that never arrived.
  it("shows a zero reading as the measurement it is", () => {
    render(
      <CalibrationSeriesTable
        series="par_sweep"
        rows={[{ stimulus: 0, par_raw: 0, par_ref: 0 }]}
      />,
    );

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getAllByText("0")).toHaveLength(3);
  });

  // A device that answers a structured reading lands it whole in one cell; the reviewer
  // opens the one they are checking rather than reading JSON across the row.
  it("opens a structured reading in place", async () => {
    render(
      <CalibrationSeriesTable
        series="par_sweep"
        rows={[{ stimulus: 0.8, par: '{"par":160,"channels":[496,352]}' }]}
      />,
    );

    expect(screen.getByText("2 fields")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("par:")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
  });

  // Six detector channels are a shape, not six numbers to read one at a time.
  it("draws a per-channel reading as its trace", () => {
    const { container } = render(
      <CalibrationSeriesTable
        series="adpd_baseline"
        rows={[{ channels: [312, 198, 245, 187, 203, 176] }]}
      />,
    );

    expect(container.querySelector("svg path")).toBeInTheDocument();
  });

  // Instruments and operators answer with more than numbers: a gate is a boolean and a
  // sensor's settings are text.
  it("renders the readings that are neither numbers nor structures", () => {
    render(
      <CalibrationSeriesTable
        series="spec_sweep"
        rows={[{ stimulus: "no filter", dark: true, settings: "atime=200,astep=200" }]}
      />,
    );

    expect(screen.getByText("no filter")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("atime=200,astep=200")).toBeInTheDocument();
  });

  it("renders nothing for a series with no points", () => {
    const { container } = render(<CalibrationSeriesTable series="empty" rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
