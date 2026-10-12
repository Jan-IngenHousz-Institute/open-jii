import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { polarDefaultConfig } from "./defaults";
import { PolarRenderer } from "./renderer";

const { polarPlot } = vi.hoisted(() => ({
  polarPlot: vi.fn((_props: { data: { name: string }[] }) => null),
}));
vi.mock("@/components/charts/polar", () => ({ PolarPlot: polarPlot }));

function plottedNames(): string[] {
  const call = polarPlot.mock.calls.at(-1);
  if (!call) {
    throw new Error("PolarPlot was never rendered");
  }
  return call[0].data.map((series) => series.name);
}

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "polar",
    chartFamily: "scientific",
    config: { ...polarDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "bearing", role: "x" },
        { tableName: "device", columnName: "signal", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("PolarRenderer", () => {
  it("shows a config error when the visualization isn't a polar", () => {
    const viz = buildViz({ chartType: "radar" });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when X is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "signal", role: "y" },
        ],
      },
    });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[{ signal: 100 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when no Y series are picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [{ tableName: "device", columnName: "bearing", role: "x" }],
      },
    });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[{ bearing: 0 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a polar trace from (theta, r) rows", () => {
    const viz = buildViz();
    const rows = [
      { bearing: 0, signal: 50 },
      { bearing: 45, signal: 70 },
      { bearing: 90, signal: 90 },
      { bearing: 135, signal: 60 },
    ];
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("splits into one trace per category when a categorical color column is set", () => {
    const viz = buildViz({
      config: { ...polarDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "bearing", role: "x" },
          { tableName: "device", columnName: "signal", role: "y" },
          { tableName: "device", columnName: "device_id", role: "color" },
        ],
      },
    });
    const rows = [
      { bearing: 0, signal: 50, device_id: "A" },
      { bearing: 90, signal: 70, device_id: "A" },
      { bearing: 0, signal: 60, device_id: "B" },
      { bearing: 90, signal: 80, device_id: "B" },
    ];
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  // A chart saved through the API has no colorMode. The renderer reads the
  // colour column's type from the table's column metadata to choose.
  describe("with no colorMode saved", () => {
    const rows = [
      { bearing: 0, signal: 50, genotype: "WT", temp: 21 },
      { bearing: 90, signal: 70, genotype: "mutant", temp: 30 },
    ];

    function colouredBy(colorColumn: string) {
      return buildViz({
        config: { ...polarDefaultConfig() },
        dataConfig: {
          tableName: "t",
          dataSources: [
            { tableName: "t", columnName: "bearing", role: "x" },
            { tableName: "t", columnName: "signal", role: "y" },
            { tableName: "t", columnName: colorColumn, role: "color" },
          ],
        },
      });
    }

    beforeEach(() => {
      polarPlot.mockClear();
      server.mount(contract.experiments.getExperimentTableColumns, {
        body: {
          columns: [
            { name: "bearing", type_name: "INT", type_text: "INT" },
            { name: "signal", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "genotype", type_name: "STRING", type_text: "STRING" },
            { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
        },
      });
    });

    it("splits a text colour column into one series per value", async () => {
      render(
        <PolarRenderer visualization={colouredBy("genotype")} experimentId="exp-1" data={rows} />,
      );

      await waitFor(() => {
        expect(plottedNames()).toEqual(expect.arrayContaining(["WT", "mutant"]));
      });
    });

    it("keeps one series for a numeric colour column", async () => {
      render(<PolarRenderer visualization={colouredBy("temp")} experimentId="exp-1" data={rows} />);

      await waitFor(() => {
        expect(plottedNames()).toEqual(["signal"]);
      });
    });
  });
});
