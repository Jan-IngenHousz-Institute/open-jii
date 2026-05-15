import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../form-values";
import { barDefaultConfig } from "./defaults";
import { BarRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "bar",
    chartFamily: "basic",
    config: barDefaultConfig() satisfies ChartFormConfig,
    dataConfig: {
      tableName: "raw_data",
      dataSources: [
        { tableName: "raw_data", columnName: "contributor", role: "x" },
        { tableName: "raw_data", columnName: "", role: "y" },
      ],
    },
    ...overrides,
  });
}

function contributorCell(id: string, name: string) {
  return JSON.stringify({ id, name, avatar: null });
}

describe("BarRenderer", () => {
  it("shows a config error when the visualization isn't a bar chart", () => {
    const viz = buildViz({ chartType: "line" });
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame for a count histogram by contributor", () => {
    const viz = buildViz({
      config: {
        ...barDefaultConfig(),
        aggregationFunction: "count",
        xColumnType: WellKnownColumnTypes.CONTRIBUTOR,
      } satisfies ChartFormConfig,
    });
    const rows = [
      { contributor: contributorCell("u1", "Ada") },
      { contributor: contributorCell("u1", "Ada") },
      { contributor: contributorCell("u2", "Grace") },
    ];
    const { container } = render(
      <BarRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders the mean-value scenario with a Y column", () => {
    const viz = buildViz({
      config: {
        ...barDefaultConfig(),
        aggregationFunction: "avg",
        xColumnType: WellKnownColumnTypes.CONTRIBUTOR,
      } satisfies ChartFormConfig,
      dataConfig: {
        tableName: "raw_data",
        dataSources: [
          { tableName: "raw_data", columnName: "contributor", role: "x" },
          { tableName: "raw_data", columnName: "phi2", role: "y" },
        ],
      },
    });
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 0.8 },
      { contributor: contributorCell("u2", "Grace"), phi2: 0.5 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders the leaderboard scenario (horizontal + sort desc + topN)", () => {
    const viz = buildViz({
      config: {
        ...barDefaultConfig(),
        aggregationFunction: "max",
        xColumnType: WellKnownColumnTypes.CONTRIBUTOR,
        orientation: "h",
        sortDirection: "desc",
        topN: 3,
      } satisfies ChartFormConfig,
      dataConfig: {
        tableName: "raw_data",
        dataSources: [
          { tableName: "raw_data", columnName: "contributor", role: "x" },
          { tableName: "raw_data", columnName: "phi2", role: "y" },
        ],
      },
    });
    const rows = [
      { contributor: contributorCell("u1", "Ada"), phi2: 0.7 },
      { contributor: contributorCell("u2", "Grace"), phi2: 0.9 },
      { contributor: contributorCell("u3", "Linus"), phi2: 0.5 },
      { contributor: contributorCell("u4", "Marie"), phi2: 0.8 },
      { contributor: contributorCell("u5", "Alan"), phi2: 0.6 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders an Unknown bucket without crashing when a contributor is null", () => {
    const viz = buildViz({
      config: {
        ...barDefaultConfig(),
        aggregationFunction: "count",
        xColumnType: WellKnownColumnTypes.CONTRIBUTOR,
      } satisfies ChartFormConfig,
    });
    const rows = [
      { contributor: contributorCell("u1", "Ada") },
      { contributor: null },
      { contributor: contributorCell("u2", "Grace") },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
