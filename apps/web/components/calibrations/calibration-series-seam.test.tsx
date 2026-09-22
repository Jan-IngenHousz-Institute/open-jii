import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationSeriesSeam } from "./calibration-series-seam";
import type { ProducedSeries } from "./produced-series";

describe("CalibrationSeriesSeam", () => {
  it("names each series the way the script has to address it", () => {
    const series: ProducedSeries[] = [
      { name: "par_sweep", columns: ["par_raw", "par_ref"], optional: false },
    ];
    render(<CalibrationSeriesSeam series={series} />);

    expect(screen.getByText('inputs["par_sweep"]')).toBeInTheDocument();
    expect(screen.getByText("par_raw · par_ref")).toBeInTheDocument();
  });

  // A phase the operator may skip still reaches the fit, which has to cope with its absence.
  it("marks a series the run may not produce", () => {
    const series: ProducedSeries[] = [{ name: "dark", columns: ["counts"], optional: true }];
    render(<CalibrationSeriesSeam series={series} />);

    expect(screen.getByText("iot.calibration.seam.optional")).toBeInTheDocument();
  });

  it("says the phase records nothing rather than showing an empty list", () => {
    render(<CalibrationSeriesSeam series={[]} />);

    expect(screen.getByText("iot.calibration.seam.recordsNothing")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
