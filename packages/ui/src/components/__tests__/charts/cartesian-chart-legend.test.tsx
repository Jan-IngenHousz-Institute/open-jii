import { fireEvent, render, waitFor } from "@testing-library/react";
import type { PlotData, PlotlyHTMLElement } from "plotly.js";
import { describe, expect, it, vi } from "vitest";

import type { CartesianSeries } from "../../charts/cartesian-chart";
import { CartesianChart } from "../../charts/cartesian-chart";

describe("CartesianChart legend", () => {
  it("recomputes grouped bar widths and offsets after a legend click", async () => {
    const data: CartesianSeries[] = [
      { traceType: "bar", name: "Primary", x: [0, 8], y: [2, 2] },
      { traceType: "bar", name: "Dense", x: [0, 0.001, 8], y: [2, 2, 2] },
      { traceType: "bar", name: "Secondary", x: [0, 8], y: [2, 2], yaxisId: "y3" },
    ];
    const onRestyle = vi.fn();
    const { container } = render(
      <CartesianChart
        data={data}
        config={{ barmode: "group", bargap: 0.15, bargroupgap: 0.05, width: 640, height: 400 }}
        onRestyle={onRestyle}
      />,
    );

    const denseLegendToggle = await waitFor(() => {
      const item = Array.from(container.querySelectorAll(".legend .traces")).find(
        (trace) => trace.textContent === "Dense",
      );
      const toggle = item?.querySelector(".legendtoggle");
      if (!toggle) throw new Error("Dense legend item is missing");
      return toggle;
    });
    const readBars = () =>
      container
        .querySelector<PlotlyHTMLElement>(".js-plotly-plot")
        ?.data?.filter((trace): trace is Partial<PlotData> => trace.type === "bar");
    expect(readBars()?.[0]?.width).toBeCloseTo(0.0002691666667, 12);
    // Plotly handles a legend click on mouseup after mousedown.
    fireEvent.mouseDown(denseLegendToggle);
    fireEvent.mouseUp(denseLegendToggle);

    await waitFor(() => {
      expect(onRestyle).toHaveBeenCalledWith([{ visible: ["legendonly"] }, [1]]);
      const bars = readBars();
      expect(bars?.map(({ width, offset }) => [width, offset])).toEqual([
        [expect.closeTo(2.153333333333, 12), expect.closeTo(-3.343333333333, 12)],
        [undefined, undefined],
        [expect.closeTo(2.153333333333, 12), expect.closeTo(1.19, 12)],
      ]);
      expect(bars?.[1]?.visible).toBe("legendonly");
    });
  });
});
