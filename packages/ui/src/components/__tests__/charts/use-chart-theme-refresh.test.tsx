import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { expect, vi, afterEach } from "vitest";

import { LineChart } from "../../charts/line-chart";
import { useChartThemeRefresh } from "../../charts/use-chart-theme-refresh";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: vi.fn(({ layout }) => (
    <div data-testid="plotly-chart" data-layout={JSON.stringify(layout)} />
  )),
}));

const LIGHT_COLORWAY = ["#111111", "#222222", "#333333", "#444444", "#555555"];
const DARK_COLORWAY = ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd", "#eeeeee"];

function setChartColors(colors: string[]) {
  colors.forEach((color, index) => {
    document.documentElement.style.setProperty(`--chart-${index + 1}`, color);
  });
}

function clearChartColors() {
  for (let index = 1; index <= 5; index++) {
    document.documentElement.style.removeProperty(`--chart-${index}`);
  }
  document.documentElement.classList.remove("dark");
}

function renderedLayout(): { colorway?: string[] } {
  const raw = screen.getByTestId("plotly-chart").getAttribute("data-layout");
  return JSON.parse(raw ?? "{}") as { colorway?: string[] };
}

afterEach(() => {
  clearChartColors();
});

describe("useChartThemeRefresh", () => {
  it("re-renders the subscriber when the dark class flips on <html>", async () => {
    let renders = 0;
    function Probe() {
      renders += 1;
      useChartThemeRefresh();
      return null;
    }

    render(<Probe />);
    const before = renders;

    await act(async () => {
      document.documentElement.classList.add("dark");
    });

    expect(renders).toBeGreaterThan(before);
  });

  it("re-resolves the chart colorway when the theme flips after render", async () => {
    setChartColors(LIGHT_COLORWAY);

    render(
      <LineChart
        data={[{ x: [1, 2, 3], y: [4, 5, 6], name: "series" }]}
        config={{ title: "Theme test" }}
      />,
    );
    expect(renderedLayout().colorway).toEqual(LIGHT_COLORWAY);

    // A theme toggle only flips the class; nothing re-renders React from
    // outside. The chart must pick up the new custom-property values itself.
    await act(async () => {
      setChartColors(DARK_COLORWAY);
      document.documentElement.classList.add("dark");
    });

    expect(renderedLayout().colorway).toEqual(DARK_COLORWAY);
  });
});
