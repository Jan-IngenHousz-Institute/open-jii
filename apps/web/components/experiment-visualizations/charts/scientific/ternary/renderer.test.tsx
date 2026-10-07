import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ternaryDefaultConfig } from "./defaults";
import { TernaryRenderer } from "./renderer";

const { ternaryPlot } = vi.hoisted(() => ({
  ternaryPlot: vi.fn((_props: { data: { name: string }[] }) => null),
}));
vi.mock("@/components/charts/ternary", () => ({ TernaryPlot: ternaryPlot }));

function plottedNames(): string[] {
  const call = ternaryPlot.mock.calls.at(-1);
  if (!call) {
    throw new Error("TernaryPlot was never rendered");
  }
  return call[0].data.map((series) => series.name);
}

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "ternary",
    chartFamily: "scientific",
    config: { ...ternaryDefaultConfig() },
    dataConfig: {
      tableName: "soil",
      dataSources: [
        { tableName: "soil", columnName: "sand", role: "x" },
        { tableName: "soil", columnName: "silt", role: "y" },
        { tableName: "soil", columnName: "clay", role: "z" },
      ],
    },
    ...overrides,
  });
}

describe("TernaryRenderer", () => {
  it("shows a config error when the visualization isn't a ternary", () => {
    const viz = buildViz({ chartType: "polar" });
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when A is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "soil",
        dataSources: [
          { tableName: "soil", columnName: "", role: "x" },
          { tableName: "soil", columnName: "silt", role: "y" },
          { tableName: "soil", columnName: "clay", role: "z" },
        ],
      },
    });
    render(
      <TernaryRenderer visualization={viz} experimentId="exp-1" data={[{ silt: 30, clay: 20 }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when B is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "soil",
        dataSources: [
          { tableName: "soil", columnName: "sand", role: "x" },
          { tableName: "soil", columnName: "", role: "y" },
          { tableName: "soil", columnName: "clay", role: "z" },
        ],
      },
    });
    render(
      <TernaryRenderer visualization={viz} experimentId="exp-1" data={[{ sand: 40, clay: 30 }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when C is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "soil",
        dataSources: [
          { tableName: "soil", columnName: "sand", role: "x" },
          { tableName: "soil", columnName: "silt", role: "y" },
          { tableName: "soil", columnName: "", role: "z" },
        ],
      },
    });
    render(
      <TernaryRenderer visualization={viz} experimentId="exp-1" data={[{ sand: 40, silt: 30 }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a ternary trace from valid (A, B, C) triplets", () => {
    const viz = buildViz();
    const rows = [
      { sand: 60, silt: 30, clay: 10 },
      { sand: 40, silt: 40, clay: 20 },
      { sand: 20, silt: 50, clay: 30 },
    ];
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops rows whose components don't all parse to numbers", () => {
    const viz = buildViz();
    const rows = [
      { sand: "n/a", silt: 50, clay: 50 },
      { sand: 60, silt: null, clay: 40 },
      { sand: 50, silt: 30, clay: 20 },
    ];
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops zero-sum rows (undefined position on the simplex)", () => {
    const viz = buildViz();
    const rows = [
      { sand: 0, silt: 0, clay: 0 },
      { sand: 50, silt: 30, clay: 20 },
    ];
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("splits into one trace per category when a categorical color column is set", () => {
    const viz = buildViz({
      config: { ...ternaryDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "soil",
        dataSources: [
          { tableName: "soil", columnName: "sand", role: "x" },
          { tableName: "soil", columnName: "silt", role: "y" },
          { tableName: "soil", columnName: "clay", role: "z" },
          { tableName: "soil", columnName: "site", role: "color" },
        ],
      },
    });
    const rows = [
      { sand: 60, silt: 30, clay: 10, site: "north" },
      { sand: 50, silt: 35, clay: 15, site: "north" },
      { sand: 40, silt: 40, clay: 20, site: "south" },
      { sand: 30, silt: 45, clay: 25, site: "south" },
    ];
    render(<TernaryRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  // A chart saved through the API has no colorMode. The renderer reads the
  // colour column's type from the table's column metadata to choose.
  describe("with no colorMode saved", () => {
    const rows = [
      { sand: 40, silt: 40, clay: 20, genotype: "WT", temp: 21 },
      { sand: 20, silt: 30, clay: 50, genotype: "mutant", temp: 30 },
    ];

    function colouredBy(colorColumn: string) {
      return buildViz({
        config: { ...ternaryDefaultConfig() },
        dataConfig: {
          tableName: "t",
          dataSources: [
            { tableName: "t", columnName: "sand", role: "x" },
            { tableName: "t", columnName: "silt", role: "y" },
            { tableName: "t", columnName: "clay", role: "z" },
            { tableName: "t", columnName: colorColumn, role: "color" },
          ],
        },
      });
    }

    beforeEach(() => {
      ternaryPlot.mockClear();
      server.mount(contract.experiments.getExperimentTableColumns, {
        body: {
          columns: [
            { name: "sand", type_name: "INT", type_text: "INT" },
            { name: "silt", type_name: "INT", type_text: "INT" },
            { name: "clay", type_name: "INT", type_text: "INT" },
            { name: "genotype", type_name: "STRING", type_text: "STRING" },
            { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
        },
      });
    });

    it("splits a text colour column into one series per value", async () => {
      render(
        <TernaryRenderer visualization={colouredBy("genotype")} experimentId="exp-1" data={rows} />,
      );

      await waitFor(() => {
        expect(plottedNames()).toEqual(expect.arrayContaining(["WT", "mutant"]));
      });
    });

    it("keeps one series for a numeric colour column", async () => {
      render(
        <TernaryRenderer visualization={colouredBy("temp")} experimentId="exp-1" data={rows} />,
      );

      await waitFor(() => {
        expect(plottedNames()).toEqual(["sand"]);
      });
    });
  });
});
