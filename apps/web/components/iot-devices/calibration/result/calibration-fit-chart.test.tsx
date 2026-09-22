import { render } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalibrationFitChart } from "./calibration-fit-chart";

interface PlottedSeries {
  name: string;
  x: number[];
  y: number[];
}

const scatter = vi.hoisted(() => ({
  calls: [] as { data: PlottedSeries[]; config: Record<string, unknown> }[],
}));

vi.mock("@/components/charts/scatter-chart", () => ({
  ScatterChart: (props: { data: PlottedSeries[]; config: Record<string, unknown> }) => {
    scatter.calls.push(props);
    return <div data-testid="scatter" />;
  },
}));

const POINTS = [
  { x: 10.46, y: 94.17 },
  { x: 6.98, y: 58.53 },
];

describe("CalibrationFitChart", () => {
  beforeEach(() => {
    scatter.calls.length = 0;
  });

  it("plots the captured points against the fitted line, over the range they cover", () => {
    render(
      <CalibrationFitChart
        points={POINTS}
        line={{ slope: 9, intercept: -1 }}
        xLabel="par_raw"
        yLabel="par_ref"
      />,
    );

    const [plotted] = scatter.calls;
    expect(plotted.data[0].x).toEqual([10.46, 6.98]);
    expect(plotted.data[0].y).toEqual([94.17, 58.53]);
    // The line is drawn from the origin to the furthest reading, so a gain is visible
    // against the points rather than floating beside them.
    expect(plotted.data[1].x).toEqual([0, 10.46]);
    expect(plotted.data[1].y[0]).toBe(-1);
    expect(plotted.data[1].y[1]).toBeCloseTo(93.14, 6);
    expect(plotted.config.xAxisTitle).toBe("par_raw");
    expect(plotted.config.yAxisTitle).toBe("par_ref");
  });

  it("plots the points alone when the coefficients describe no line", () => {
    render(<CalibrationFitChart points={POINTS} line={null} xLabel="par_raw" yLabel="par_ref" />);

    expect(scatter.calls[0].data).toHaveLength(1);
  });
});
