import {
  createExperimentDataTable,
  createExperimentTable,
  createVisualization,
} from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { lineDefaultConfig } from "../basic/line/defaults";
import { CartesianRenderer } from "./cartesian-renderer";

interface CartesianChartProps {
  config: PlotlyChartConfig;
  data: { x: unknown[]; mode?: string; name?: string }[];
  onRelayout?: (event: Record<string, unknown>) => void;
}

const { cartesianChart } = vi.hoisted(() => ({
  cartesianChart: vi.fn((_props: CartesianChartProps) => null),
}));
vi.mock("@/components/charts/cartesian-chart", () => ({
  CartesianChart: cartesianChart,
}));

function renderedProps(): CartesianChartProps {
  const call = cartesianChart.mock.calls.at(-1);
  if (!call) {
    throw new Error("CartesianChart was never rendered");
  }
  return call[0];
}

function renderedConfig(): PlotlyChartConfig {
  return renderedProps().config;
}

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "line",
    chartFamily: "basic",
    config: { ...lineDefaultConfig() },
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "load", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("CartesianRenderer", () => {
  beforeEach(() => {
    cartesianChart.mockClear();
  });

  // The stored config carries `useWebGL: false` from the chart-type defaults,
  // and no UI can change it, so the point count is what has to decide.
  describe("WebGL escalation", () => {
    const rowsOf = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ time: i, load: i % 97 }));

    it("escalates a chart drawing more markers than SVG handles to WebGL", () => {
      render(
        <CartesianRenderer
          visualization={buildViz({ chartType: "scatter" })}
          experimentId="exp-1"
          data={rowsOf(5001)}
          defaultTraceType="scatter"
        />,
      );
      expect(renderedConfig().useWebGL).toBe(true);
    });

    it("keeps a long line on SVG, where it is one path however long", () => {
      render(
        <CartesianRenderer
          visualization={buildViz()}
          experimentId="exp-1"
          data={rowsOf(40_000)}
          defaultTraceType="line"
        />,
      );
      expect(renderedConfig().useWebGL).toBe(false);
    });

    it("escalates a long line with error bars, which SVG draws one by one", () => {
      const viz = buildViz({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "load", role: "y", errorColumn: "spread" },
          ],
        },
      });
      const rows = Array.from({ length: 40_000 }, (_, i) => ({
        time: i,
        load: Math.sin(i),
        spread: 1,
      }));
      render(
        <CartesianRenderer
          visualization={viz}
          experimentId="exp-1"
          data={rows}
          defaultTraceType="line"
        />,
      );
      expect(renderedConfig().useWebGL).toBe(true);
    });

    it("leaves a small chart on SVG", () => {
      render(
        <CartesianRenderer
          visualization={buildViz()}
          experimentId="exp-1"
          data={rowsOf(200)}
          defaultTraceType="line"
        />,
      );
      expect(renderedConfig().useWebGL).toBe(false);
    });

    it("honours a config that explicitly opts in", () => {
      const viz = buildViz({ config: { ...lineDefaultConfig(), useWebGL: true } });
      render(
        <CartesianRenderer
          visualization={viz}
          experimentId="exp-1"
          data={rowsOf(10)}
          defaultTraceType="line"
        />,
      );
      expect(renderedConfig().useWebGL).toBe(true);
    });
  });

  describe("screen resolution", () => {
    const rows = Array.from({ length: 40_000 }, (_, i) => ({ time: i, load: Math.sin(i / 30) }));

    function renderLongLine() {
      render(
        <CartesianRenderer
          visualization={buildViz()}
          experimentId="exp-1"
          data={rows}
          defaultTraceType="line"
        />,
      );
    }

    it("draws a long line at screen resolution and says so", () => {
      renderLongLine();

      expect(renderedProps().data[0].x.length).toBeLessThan(10_000);
      expect(screen.getByText("charts.reduced")).toBeInTheDocument();
    });

    it("draws every point on request, and back", async () => {
      renderLongLine();

      await userEvent.click(screen.getByRole("button", { name: "charts.showAllPoints" }));
      expect(renderedProps().data[0].x).toHaveLength(40_000);
      expect(screen.getByText("charts.showingAllPoints")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "charts.drawAtResolution" }));
      expect(renderedProps().data[0].x.length).toBeLessThan(10_000);
    });

    it("hides the markers of a densely marked line and offers them back", async () => {
      const viz = buildViz({ config: { ...lineDefaultConfig(), mode: "lines+markers" } });
      render(
        <CartesianRenderer
          visualization={viz}
          experimentId="exp-1"
          data={rows.slice(0, 2_500)}
          defaultTraceType="line"
        />,
      );
      expect(renderedProps().data[0].mode).toBe("lines");
      expect(screen.getByText("charts.reduced")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "charts.showAllPoints" }));
      expect(renderedProps().data[0].mode).toBe("lines+markers");
    });

    it("redraws the zoomed range at full detail", () => {
      renderLongLine();

      act(() => renderedProps().onRelayout?.({ "xaxis.range[0]": 1_000, "xaxis.range[1]": 1_100 }));

      const zoomed = renderedProps().data[0].x;
      expect(zoomed[0]).toBe(999);
      expect(zoomed).toHaveLength(103);
    });
  });

  it("shows the empty-state when there are no rows", () => {
    render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={[]}
        defaultTraceType="line"
      />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const rows = [
      { time: 1, load: 10 },
      { time: 2, load: 20 },
    ];
    const { container } = render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders when only Y is configured (X synthesised from row indices)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
        ],
      },
    });
    const rows = [{ load: 10 }, { load: 20 }];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders multiple Y series without throwing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
          { tableName: "readings", columnName: "saturation", role: "y" },
        ],
      },
    });
    const rows = [
      { time: 1, load: 10, saturation: 30 },
      { time: 2, load: 20, saturation: 40 },
    ];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders with a categorical color mapping", () => {
    const viz = buildViz({
      config: { ...lineDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
          { tableName: "readings", columnName: "lab", role: "color" },
        ],
      },
    });
    const rows = [
      { time: 1, load: 10, lab: "A" },
      { time: 2, load: 20, lab: "B" },
    ];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("forwards the supportsContinuousColor flag without throwing", () => {
    const rows = [
      { time: 1, load: 10 },
      { time: 2, load: 20 },
    ];
    render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="scatter"
        supportsContinuousColor
        supportsSize
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  // A chart saved through the API has no colorMode. The renderer reads the
  // colour column's type from the table's column metadata to choose.
  describe("reads of a long series", () => {
    const answer = (call: SpyCall) => {
      const aggregation = call.query.aggregation || "";
      const rows = aggregation.includes("widthBucket")
        ? [
            {
              x_from: "2026-09-25T00:00:00.000Z",
              x_to: "2026-09-25T00:30:00.000Z",
              y0_low: "1",
              y0_high: "9",
              rows: "40000",
            },
            {
              x_from: "2026-09-25T01:00:00.000Z",
              x_to: "2026-09-25T01:30:00.000Z",
              y0_low: "2",
              y0_high: "8",
              rows: "40000",
            },
          ]
        : aggregation
          ? [{ x_from: "2026-09-25T00:00:00.000Z", x_to: "2026-09-26T00:00:00.000Z" }]
          : [{ time: "2026-09-25T00:00:00.000Z", load: "5" }];
      return [
        createExperimentDataTable({
          data: { columns: [], rows, totalRows: rows.length, truncated: false },
        }),
      ];
    };

    function mountTable(totalRows: number) {
      server.mount(contract.experiments.getExperimentTables, {
        body: [createExperimentTable({ identifier: "readings", totalRows })],
      });
      server.mount(contract.experiments.getExperimentTableColumns, {
        body: {
          columns: [
            { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
            { name: "load", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
        },
      });
      return server.mount(contract.experiments.getExperimentData, { body: answer });
    }

    it("draws a line over a large table from buckets without reading its rows", async () => {
      const reads = mountTable(80_000);

      render(
        <CartesianRenderer
          visualization={buildViz()}
          experimentId="exp-1"
          defaultTraceType="line"
        />,
      );

      await waitFor(() => expect(renderedProps().data[0]?.x).toHaveLength(4));
      expect(reads.calls.every((call) => Boolean(call.query.aggregation))).toBe(true);
    });

    it("reads a small table's rows whole", async () => {
      const reads = mountTable(500);

      render(
        <CartesianRenderer
          visualization={buildViz()}
          experimentId="exp-1"
          defaultTraceType="line"
        />,
      );

      await waitFor(() => expect(renderedProps().data[0]?.x).toHaveLength(1));
      expect(reads.calls.some((call) => Boolean(call.query.aggregation))).toBe(false);
    });
  });

  describe("with no colorMode saved", () => {
    function scatterColouredBy(colorColumn: string) {
      return buildViz({
        chartType: "scatter",
        config: { showLegend: true },
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "load", role: "y" },
            { tableName: "readings", columnName: colorColumn, role: "color" },
          ],
        },
      });
    }

    const rows = [
      { time: 1, load: 10, genotype: "WT", temp: 23.7 },
      { time: 2, load: 20, genotype: "mutant", temp: 36.3 },
    ];

    beforeEach(() => {
      server.mount(contract.experiments.getExperimentTableColumns, {
        body: {
          columns: [
            { name: "time", type_name: "INT", type_text: "INT" },
            { name: "load", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "genotype", type_name: "STRING", type_text: "STRING" },
            { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
        },
      });
    });

    it("splits a text colour column into one series per value", async () => {
      render(
        <CartesianRenderer
          visualization={scatterColouredBy("genotype")}
          experimentId="exp-1"
          data={rows}
          defaultTraceType="scatter"
          supportsContinuousColor
        />,
      );

      await waitFor(() => {
        expect(renderedProps().data.map((s) => s.name)).toEqual(
          expect.arrayContaining(["WT", "mutant"]),
        );
      });
    });

    it("keeps one gradient series for a numeric colour column", async () => {
      render(
        <CartesianRenderer
          visualization={scatterColouredBy("temp")}
          experimentId="exp-1"
          data={rows}
          defaultTraceType="scatter"
          supportsContinuousColor
        />,
      );

      await waitFor(() => {
        expect(renderedProps().data).toHaveLength(1);
      });
      expect(renderedProps().data[0].name).toBe("load");
    });
  });
});
