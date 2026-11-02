import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoxPlot } from "../../charts/box-plot";
import type { FacetGridConfig } from "../../charts/cartesian-chart";
import { PlotlyChart } from "../../charts/plotly-chart";
import { ViolinPlot } from "../../charts/violin-plot";

vi.mock("../../charts/plotly-chart", () => ({ PlotlyChart: vi.fn(() => null) }));

const cells = ["", "2", "3"].map((suffix) => ({
  title: `Panel ${suffix || "1"}`,
  xaxisId: `x${suffix}`,
  yaxisId: `y${suffix}`,
}));
const subplots: FacetGridConfig = { rows: 2, columns: 2, cells };

for (const Chart of [BoxPlot, ViolinPlot]) {
  describe(Chart.name, () => {
    it("reuses series slots across panels, including empty series and missing categories", () => {
      const data = cells.flatMap((cell, panel) => [
        { ...cell, name: "First", x: ["A", "A"], y: [1, 2] },
        { ...cell, name: "Second", x: panel === 1 ? [] : ["B", "B"], y: panel === 1 ? [] : [3, 4] },
      ]);
      render(<Chart data={data} subplots={subplots} />);
      const traces = vi.mocked(PlotlyChart).mock.lastCall![0].data;
      const groups = traces.map((trace) =>
        "offsetgroup" in trace ? trace.offsetgroup : undefined,
      );
      expect(groups[0]).toBeTruthy();
      expect(groups[1]).not.toBe(groups[0]);
      expect(groups).toEqual([groups[0], groups[1], groups[0], groups[1], groups[0], groups[1]]);
    });

    it("leaves Plotly's default grouping for an unfaceted chart", () => {
      render(<Chart data={[{ name: "First", x: ["A", "A"], y: [1, 2] }]} />);
      const trace = vi.mocked(PlotlyChart).mock.lastCall![0].data[0];
      expect(trace && "offsetgroup" in trace ? trace.offsetgroup : undefined).toBeUndefined();
    });
  });
}
