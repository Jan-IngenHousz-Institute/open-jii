import {
  getChartTypeDef,
  listChartTypes,
} from "@/components/experiment-visualizations/charts/chart-registry";
import type { ChartTypeDef } from "@/components/experiment-visualizations/charts/types";
import { VisualizationWorkspace } from "@/components/experiment-visualizations/workspace/visualization-workspace";
import {
  createExperimentAccess,
  createExperimentDataTable,
  createExperimentTable,
  createVisualization,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import VisualizationLayout from "./layout";

vi.mock("@/components/charts/plotly-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return { ...actual, PlotlyChart: () => null };
});

// Past useAutosave's 1s debounce.
const AUTOSAVE_WINDOW_MS = 2000;

/** Every source bound to a real column, so the shelves render their per-series controls. */
function visualizationFor(def: ChartTypeDef) {
  const dataConfig = def.defaultDataConfig("readings");
  return createVisualization({
    id: "viz-1",
    experimentId: "exp-1",
    chartFamily: def.family,
    chartType: def.type,
    config: def.defaultConfig(),
    dataConfig: {
      ...dataConfig,
      dataSources: dataConfig.dataSources.map((source) => ({
        ...source,
        columnName: source.role === "x" ? "time" : "value",
      })),
    },
  });
}

/** Coloured by a text column with no colour mode stored, as a chart authored through the API arrives. */
function colouredByText(def: ChartTypeDef): ExperimentVisualization {
  const { colorMode: _unset, ...config } = def.defaultConfig();
  const visualization = visualizationFor(def);
  return {
    ...visualization,
    config,
    dataConfig: {
      ...visualization.dataConfig,
      dataSources: [
        ...visualization.dataConfig.dataSources,
        { tableName: "readings", columnName: "genotype", role: "color" },
      ],
    },
  };
}

function mountEndpoints(
  def: ChartTypeDef,
  {
    isAdmin,
    visualization = visualizationFor(def),
  }: { isAdmin: boolean; visualization?: ExperimentVisualization },
) {
  server.mount(contract.experiments.getExperimentVisualization, { body: visualization });
  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({ isAdmin }),
  });
  server.mount(contract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: "readings", displayName: "readings" })],
  });
  const table = createExperimentDataTable({
    name: "readings",
    data: {
      columns: [
        { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "genotype", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        { time: 1, value: 10, genotype: "WT" },
        { time: 2, value: 20, genotype: "mut" },
      ],
      totalRows: 2,
      truncated: false,
    },
  });
  server.mount(contract.experiments.getExperimentTableColumns, {
    body: { columns: table.data?.columns ?? [] },
  });
  const data = server.mount(contract.experiments.getExperimentData, { body: [table] });
  const update = server.mount(contract.experiments.updateExperimentVisualization, {
    body: visualization,
  });
  return { data, update };
}

// StrictMode replays mount effects, so a value written while the editor mounts
// reaches autosave here, as any later form update would carry it in production.
function renderEditor() {
  return render(
    <StrictMode>
      <VisualizationLayout>
        <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
      </VisualizationLayout>
    </StrictMode>,
  );
}

async function switchToScatter() {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  await user.click(await screen.findByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
  await user.click(
    await screen.findByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
  );
  await user.click(await screen.findByRole("button", { name: "workspace.charts.switchConfirm" }));
}

describe("VisualizationLayout autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useParams).mockReturnValue({ id: "exp-1", visualizationId: "viz-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(listChartTypes().map((def) => [def.type, def] as const))(
    "does not save when a %s chart opens",
    async (_type, def) => {
      const { data, update } = mountEndpoints(def, { isAdmin: true });

      renderEditor();
      await waitFor(() => expect(data.called).toBe(true));
      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_WINDOW_MS));

      expect(update.called).toBe(false);
    },
  );

  it.each(["line", "scatter"] as const)(
    "does not save when a %s chart coloured by a text column opens",
    async (type) => {
      const def = getChartTypeDef(type);
      const { data, update } = mountEndpoints(def, {
        isAdmin: true,
        visualization: colouredByText(def),
      });

      renderEditor();
      await waitFor(() => expect(data.called).toBe(true));
      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_WINDOW_MS));

      expect(update.called).toBe(false);
    },
  );

  it("does not save when the style tab opens", async () => {
    const { data, update } = mountEndpoints(getChartTypeDef("line"), { isAdmin: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    renderEditor();
    await waitFor(() => expect(data.called).toBe(true));
    await user.click(await screen.findByRole("tab", { name: /workspace\.inspector\.tabs\.style/ }));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_WINDOW_MS));

    expect(update.called).toBe(false);
  });

  it("saves an admin's edit", async () => {
    const { update } = mountEndpoints(getChartTypeDef("line"), { isAdmin: true });

    renderEditor();
    await switchToScatter();
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_WINDOW_MS));

    await waitFor(() => expect(update.called).toBe(true));
  });

  it("never saves, or reports a save state, for a viewer's edit", async () => {
    const { update } = mountEndpoints(getChartTypeDef("line"), { isAdmin: false });

    renderEditor();
    await switchToScatter();
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_WINDOW_MS));

    expect(update.called).toBe(false);
    expect(screen.queryByText("autosave.saved")).not.toBeInTheDocument();
    expect(screen.queryByText("autosave.saving")).not.toBeInTheDocument();
  });
});
