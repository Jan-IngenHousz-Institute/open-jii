import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { expect, vi, afterEach } from "vitest";

import { LineChart } from "../../charts/line-chart";
import { useChartThemeRefresh } from "../../charts/use-chart-theme-refresh";
import { ThemeProvider, ThemeToggle } from "../../theme";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: vi.fn(({ layout }) => (
    <div data-testid="plotly-chart" data-layout={JSON.stringify(layout)} />
  )),
}));

// The theme-backed head of the colorway, in palette order. Everything past it
// is Plotly's frozen hex, which cannot move with the theme and is not asserted.
const HEAD_TOKENS = [
  "--chart-1",
  "--chart-4",
  "--node-question",
  "--chart-2",
  "--node-measurement",
  "--node-branch",
];
const LIGHT_COLORWAY = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"];
const DARK_COLORWAY = ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd", "#eeeeee", "#ffffff"];

function setChartColors(colors: string[]) {
  HEAD_TOKENS.forEach((token, index) => {
    const color = colors[index];
    if (color !== undefined) document.documentElement.style.setProperty(token, color);
  });
}

function clearChartColors() {
  for (const token of HEAD_TOKENS) {
    document.documentElement.style.removeProperty(token);
  }
  document.documentElement.classList.remove("dark");
}

function renderedLayout(): { colorway?: string[] } {
  const raw = screen.getByTestId("plotly-chart").getAttribute("data-layout");
  return JSON.parse(raw ?? "{}") as { colorway?: string[] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  clearChartColors();
});

describe("useChartThemeRefresh", () => {
  it("shares one root-class observer across every chart subscriber", () => {
    const NativeMutationObserver = globalThis.MutationObserver;
    const observerConstructed = vi.fn();
    class CountingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        observerConstructed();
      }
    }
    vi.stubGlobal("MutationObserver", CountingMutationObserver);

    function Probe() {
      useChartThemeRefresh();
      return null;
    }

    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <Probe />
        <Probe />
        <Probe />
      </ThemeProvider>,
    );

    expect(observerConstructed).toHaveBeenCalledTimes(1);
  });

  it("re-renders the subscriber when the effective provider theme changes", async () => {
    const user = userEvent.setup();
    let renders = 0;
    function Probe() {
      renders += 1;
      useChartThemeRefresh();
      return null;
    }

    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <ThemeToggle />
        <Probe />
      </ThemeProvider>,
    );
    const before = renders;

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(renders).toBeGreaterThan(before);
  });

  it("re-resolves the chart colorway when the theme flips after render", async () => {
    const user = userEvent.setup();
    setChartColors(LIGHT_COLORWAY);

    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <ThemeToggle />
        <LineChart
          data={[{ x: [1, 2, 3], y: [4, 5, 6], name: "series" }]}
          config={{ title: "Theme test" }}
        />
      </ThemeProvider>,
    );
    expect(renderedLayout().colorway?.slice(0, HEAD_TOKENS.length)).toEqual(LIGHT_COLORWAY);

    setChartColors(DARK_COLORWAY);
    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));

    expect(renderedLayout().colorway?.slice(0, HEAD_TOKENS.length)).toEqual(DARK_COLORWAY);
  });
});
