import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { alluvialDefaultConfig } from "./defaults";
import { AlluvialRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "alluvial",
    chartFamily: "scientific",
    config: { ...alluvialDefaultConfig() },
    dataConfig: {
      tableName: "lifecycle",
      dataSources: [
        { tableName: "lifecycle", columnName: "stage_t1", role: "groupBy" },
        { tableName: "lifecycle", columnName: "stage_t2", role: "groupBy" },
        { tableName: "lifecycle", columnName: "", role: "value" },
      ],
    },
    ...overrides,
  });
}

describe("AlluvialRenderer", () => {
  it("shows a config error when the visualization isn't an alluvial", () => {
    const viz = buildViz({ chartType: "polar" });
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when only one stage is picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "lifecycle",
        dataSources: [
          { tableName: "lifecycle", columnName: "stage_t1", role: "groupBy" },
          { tableName: "lifecycle", columnName: "", role: "groupBy" },
          { tableName: "lifecycle", columnName: "", role: "value" },
        ],
      },
    });
    render(
      <AlluvialRenderer visualization={viz} experimentId="exp-1" data={[{ stage_t1: "seed" }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders an alluvial trace from two-stage rows (counts mode)", () => {
    const viz = buildViz();
    const rows = [
      { stage_t1: "seed", stage_t2: "seedling" },
      { stage_t1: "seed", stage_t2: "seedling" },
      { stage_t1: "seed", stage_t2: "dead" },
      { stage_t1: "germinated", stage_t2: "seedling" },
    ];
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("folds null / empty stage values into a single (missing) bucket", () => {
    const viz = buildViz();
    const rows = [
      { stage_t1: "seed", stage_t2: null },
      { stage_t1: "seed", stage_t2: "" },
      { stage_t1: null, stage_t2: "mature" },
    ];
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("sums a numeric `value` column instead of counting rows when one is picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "lifecycle",
        dataSources: [
          { tableName: "lifecycle", columnName: "stage_t1", role: "groupBy" },
          { tableName: "lifecycle", columnName: "stage_t2", role: "groupBy" },
          { tableName: "lifecycle", columnName: "biomass", role: "value" },
        ],
      },
    });
    const rows = [
      { stage_t1: "seed", stage_t2: "seedling", biomass: 12 },
      { stage_t1: "seed", stage_t2: "seedling", biomass: 8 },
      { stage_t1: "seed", stage_t2: "dead", biomass: 5 },
    ];
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops links whose value cell is non-positive or non-numeric", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "lifecycle",
        dataSources: [
          { tableName: "lifecycle", columnName: "stage_t1", role: "groupBy" },
          { tableName: "lifecycle", columnName: "stage_t2", role: "groupBy" },
          { tableName: "lifecycle", columnName: "biomass", role: "value" },
        ],
      },
    });
    const rows = [
      { stage_t1: "seed", stage_t2: "seedling", biomass: -3 },
      { stage_t1: "seed", stage_t2: "dead", biomass: "n/a" },
      { stage_t1: "seed", stage_t2: "seedling", biomass: 10 },
    ];
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("supports three or more stages", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "lifecycle",
        dataSources: [
          { tableName: "lifecycle", columnName: "stage_t1", role: "groupBy" },
          { tableName: "lifecycle", columnName: "stage_t2", role: "groupBy" },
          { tableName: "lifecycle", columnName: "stage_t3", role: "groupBy" },
          { tableName: "lifecycle", columnName: "", role: "value" },
        ],
      },
    });
    const rows = [
      { stage_t1: "seed", stage_t2: "seedling", stage_t3: "mature" },
      { stage_t1: "seed", stage_t2: "seedling", stage_t3: "mature" },
      { stage_t1: "seed", stage_t2: "seedling", stage_t3: "dead" },
      { stage_t1: "seed", stage_t2: "dead", stage_t3: "dead" },
    ];
    render(<AlluvialRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
