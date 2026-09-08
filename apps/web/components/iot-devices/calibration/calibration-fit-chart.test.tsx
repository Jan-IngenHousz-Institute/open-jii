import { render } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ScatterChart } from "@repo/ui/components/charts/scatter-chart";

import { CalibrationFitChart } from "./calibration-fit-chart";

vi.mock("@repo/ui/components/charts/scatter-chart", () => ({
  ScatterChart: vi.fn(() => <div data-testid="scatter-chart" />),
}));

describe("CalibrationFitChart", () => {
  it("plots the captured points and the fitted line across their range from zero", () => {
    render(
      <CalibrationFitChart
        points={[
          { x: 8.33, y: 6.92 },
          { x: 420, y: 402.12 },
        ]}
        slope={0.96}
        intercept={-1.08}
      />,
    );

    const [points, line] = vi.mocked(ScatterChart).mock.calls[0][0].data;
    expect(points).toMatchObject({
      name: "iot.calibration.review.points",
      x: [8.33, 420],
      y: [6.92, 402.12],
    });
    expect(line).toMatchObject({ name: "iot.calibration.review.fitLine", x: [0, 420] });
    expect(line.y[0]).toBeCloseTo(-1.08, 6);
    expect(line.y[1]).toBeCloseTo(0.96 * 420 - 1.08, 6);
  });
});
