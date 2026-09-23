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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

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

function mountEndpoints(def: ChartTypeDef, { isAdmin }: { isAdmin: boolean }) {
  const visualization = visualizationFor(def);
  server.mount(contract.experiments.getExperimentVisualization, { body: visualization });
  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({ isAdmin }),
  });
  server.mount(contract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: "readings", displayName: "readings" })],
  });
  const data = server.mount(contract.experiments.getExperimentData, {
    body: [createExperimentDataTable({ name: "readings" })],
  });
  const update = server.mount(contract.experiments.updateExperimentVisualization, {
    body: visualization,
  });
  return { data, update };
}

function renderEditor() {
  return render(
    <VisualizationLayout>
      <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
    </VisualizationLayout>,
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
