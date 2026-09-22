import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalibrationSetpointShape } from "./calibration-setpoint-shape";

interface PlottedSeries {
  x: number[];
  y: number[];
  mode?: string;
}

const scatter = vi.hoisted(() => ({ calls: [] as { data: PlottedSeries[] }[] }));

// Plotly has no business in jsdom; what matters here is the points it is handed.
vi.mock("@/components/charts/scatter-chart", () => ({
  ScatterChart: (props: { data: PlottedSeries[] }) => {
    scatter.calls.push(props);
    return <div data-testid="scatter" />;
  },
}));

describe("CalibrationSetpointShape", () => {
  beforeEach(() => {
    scatter.calls = [];
  });

  it("plots each setpoint against its position in the sweep", () => {
    render(<CalibrationSetpointShape values={[0.8, 2.4, 3, 4, 6.6, 0]} unit="A" />);

    expect(screen.getByTestId("scatter")).toBeInTheDocument();
    expect(scatter.calls[0].data[0]).toMatchObject({
      x: [1, 2, 3, 4, 5, 6],
      y: [0.8, 2.4, 3, 4, 6.6, 0],
      mode: "lines+markers",
    });
  });

  // Two points make a line whatever the spacing, so the shape says nothing until there are
  // more. A sweep is also allowed to be that short.
  it("draws nothing for a sweep too short to have a shape", () => {
    render(<CalibrationSetpointShape values={[0, 10]} unit="A" />);

    expect(screen.queryByTestId("scatter")).toBeNull();
    expect(scatter.calls).toHaveLength(0);
  });

  it("names the span in the setpoint's unit", () => {
    render(<CalibrationSetpointShape values={[0.8, 2.4, 6.6]} unit="A" />);

    expect(screen.getByText("iot.calibration.procedure.sweepSpan")).toBeInTheDocument();
  });

  // An operator-driven sweep has no instrument behind it, so there is no unit to name.
  it("leaves the unit out when nothing declares one", () => {
    render(<CalibrationSetpointShape values={[1, 2, 3]} unit={undefined} />);

    expect(screen.getByText("iot.calibration.procedure.sweepSpanPlain")).toBeInTheDocument();
  });
});
