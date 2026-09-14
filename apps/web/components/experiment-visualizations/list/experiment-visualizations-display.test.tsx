import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { beforeAll, beforeEach, describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import ExperimentVisualizationsDisplay from "./experiment-visualizations-display";

// Embla carousel uses IntersectionObserver; jsdom doesn't ship one.
beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    class IO {
      observe() {
        /* noop */
      }
      unobserve() {
        /* noop */
      }
      disconnect() {
        /* noop */
      }
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    }
    Object.defineProperty(globalThis, "IntersectionObserver", { value: IO, writable: true });
    Object.defineProperty(window, "IntersectionObserver", { value: IO, writable: true });
  }
});

describe("ExperimentVisualizationsDisplay", () => {
  beforeEach(() => {
    // The auto-selected viz mounts the real chart renderer, which fetches
    // via useChartData; provide an empty default so MSW stops warning.
    server.mount(contract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });
  });

  it("shows loading skeleton when isLoading prop is true", () => {
    render(
      <ExperimentVisualizationsDisplay experimentId="exp-1" visualizations={[]} isLoading={true} />,
    );

    expect(screen.getByText("ui.title")).toBeInTheDocument();
    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty message when no visualizations exist", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "selector.createVisualization" })
        .querySelector(".lucide-plus"),
    ).toBeInTheDocument();
  });

  it("lists every visualization as its own preview card, like the dashboards tab", () => {
    const viz1 = createVisualization({ name: "Line Chart" });
    const viz2 = createVisualization({ name: "Scatter Plot", chartType: "scatter" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz1, viz2]}
        isLoading={false}
      />,
    );

    // Previously one at a time behind a dropdown; now each is a card, so a
    // reader sees what is there without opening a selector.
    expect(screen.getByRole("link", { name: /Line Chart/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scatter Plot/ })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("links each card at the visualization and offers a way to all of them", () => {
    const viz = createVisualization({ name: "Line Chart", id: "viz-1" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz]}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("link", { name: /Line Chart/ })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/exp-1/analysis/visualizations/viz-1",
    );
    expect(screen.getByRole("link", { name: "ui.labels.viewAll" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/exp-1/analysis/visualizations",
    );
  });

  it("points an archived experiment at its archive route", () => {
    const viz = createVisualization({ name: "Line Chart", id: "viz-1" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz]}
        isLoading={false}
        isArchived
      />,
    );

    expect(screen.getByRole("link", { name: /Line Chart/ })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments-archive/exp-1/analysis/visualizations/viz-1",
    );
  });
});
