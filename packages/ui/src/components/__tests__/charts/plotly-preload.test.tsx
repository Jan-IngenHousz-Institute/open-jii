import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlotlyPreload } from "../../charts/plotly-preload";

const { preloadPlotly } = vi.hoisted(() => ({ preloadPlotly: vi.fn() }));
vi.mock("../../charts/plotly-chart", () => ({ preloadPlotly }));

describe("PlotlyPreload", () => {
  it("starts the Plotly download on mount and renders nothing", () => {
    const { container } = render(<PlotlyPreload />);

    expect(preloadPlotly).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
