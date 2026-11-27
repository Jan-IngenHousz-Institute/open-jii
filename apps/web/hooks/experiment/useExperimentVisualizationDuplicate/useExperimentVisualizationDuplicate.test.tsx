import type { ChartFormValues } from "@/components/experiment-visualizations/charts/chart-config";
import { useVisualizationAutosave } from "@/components/experiment-visualizations/workspace/hooks/use-visualization-autosave";
import {
  AutosaveStatusProvider,
  useReportAutosaveStatus,
} from "@/components/shared/autosave/autosave-status-context";
import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentVisualizationDuplicate } from "./useExperimentVisualizationDuplicate";

const source = createVisualization({
  id: "source",
  name: "Growth",
  description: "A saved chart",
  config: { showLegend: false, xAxisTitle: "Days", custom: { color: "red" } },
  dataConfig: {
    tableName: "measurements",
    dataSources: [{ tableName: "measurements", columnName: "height", role: "y" }],
    filters: [{ column: "height", operator: "greater_than", value: 10 }],
  },
});

function mountSource() {
  server.mount(contract.experiments.getExperimentVisualization, { body: source });
  server.mount(contract.experiments.listExperimentVisualizations, { body: [source] });
}

describe("useExperimentVisualizationDuplicate", () => {
  it("copies every saved setting and checks all names in one list request", async () => {
    server.mount(contract.experiments.getExperimentVisualization, { body: source });
    const list = server.mount(contract.experiments.listExperimentVisualizations, {
      body: [
        ...Array.from({ length: 100 }, () => createVisualization()),
        createVisualization({ name: "Growth (copy)" }),
      ],
    });
    const created = createVisualization({ name: "Growth (copy) 2" });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
    });
    const { result } = renderHook(() => useExperimentVisualizationDuplicate("exp-1", source.id));
    await act(async () => {
      expect(await result.current.duplicate()).toEqual(created);
    });
    expect(list.callCount).toBe(1);
    expect(create.callCount).toBe(1);
    expect(create.body).toEqual({
      name: "Growth (copy) 2",
      description: source.description,
      chartFamily: source.chartFamily,
      chartType: source.chartType,
      config: source.config,
      dataConfig: source.dataConfig,
    });
  });

  it("blocks a second click while the saved source is being fetched", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    mountSource();
    const fetchSource = server.mount(contract.experiments.getExperimentVisualization, {
      body: source,
      unblock: promise,
    });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: source,
    });
    const { result } = renderHook(() => useExperimentVisualizationDuplicate("exp-1", source.id));
    let pending: ReturnType<typeof result.current.duplicate> | undefined;
    act(() => {
      pending = result.current.duplicate();
    });
    await waitFor(() => expect(fetchSource.called).toBe(true));
    await act(async () => {
      await result.current.duplicate();
    });
    await act(async () => {
      resolve();
      await pending;
    });
    expect(create.callCount).toBe(1);
  });

  it("can retry a failed create without changing the source", async () => {
    mountSource();
    server.mount(contract.experiments.createExperimentVisualization, { status: 500 });
    const { result } = renderHook(() => useExperimentVisualizationDuplicate("exp-1", source.id));
    await act(async () => {
      expect(await result.current.duplicate()).toBeUndefined();
    });
    expect(result.current.disabled).toBe(false);
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: source,
    });
    await act(async () => {
      expect(await result.current.duplicate()).toEqual(source);
    });
    expect(create.callCount).toBe(1);
    expect(source.name).toBe("Growth");
  });

  it("waits for unsaved edits even when the latest report is from an idle dashboard", () => {
    function Reports({ children }: { children: ReactNode }) {
      return (
        <AutosaveStatusProvider>
          <ChartReport />
          <DashboardReport />
          {children}
        </AutosaveStatusProvider>
      );
    }
    function ChartReport() {
      useReportAutosaveStatus({ status: "dirty", hasUnsavedChanges: true, error: null });
      return null;
    }
    function DashboardReport() {
      useReportAutosaveStatus({ status: "idle", error: null });
      return null;
    }
    function Action() {
      const { disabled } = useExperimentVisualizationDuplicate("exp-1", source.id);
      return <button disabled={disabled}>Duplicate</button>;
    }
    render(
      <Reports>
        <Action />
      </Reports>,
    );
    expect(screen.getByRole("button", { name: /^Duplicate$/u })).toBeDisabled();
  });
  it("waits for a real chart autosave, including a save that outlives the inspector", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = Promise.withResolvers<void>();
    const saved = { ...source, name: "Updated growth" };
    const update = server.mount(contract.experiments.updateExperimentVisualization, {
      body: saved,
      unblock: promise,
    });
    server.mount(contract.experiments.getExperimentVisualization, { body: saved });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [saved] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: saved,
    });
    function ChartEditor() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          name: source.name,
          description: source.description ?? "",
          chartFamily: source.chartFamily,
          chartType: source.chartType,
          config: source.config ?? {},
          dataConfig: source.dataConfig,
        },
      });
      useVisualizationAutosave({ form, experimentId: "exp-1", visualizationId: source.id });
      return (
        <button onClick={() => form.setValue("name", saved.name, { shouldDirty: true })}>
          Rename
        </button>
      );
    }
    function OtherCopyActions() {
      const otherChart = useExperimentVisualizationDuplicate("exp-1", "other");
      const otherExperiment = useExperimentVisualizationDuplicate("exp-2", source.id);
      return (
        <>
          <button disabled={otherChart.disabled}>Duplicate other chart</button>
          <button disabled={otherExperiment.disabled}>Duplicate in other experiment</button>
        </>
      );
    }
    function Workspace() {
      const [open, setOpen] = useState(true);
      const { duplicate, disabled } = useExperimentVisualizationDuplicate("exp-1", source.id);
      return (
        <>
          {open && <ChartEditor />}
          <button onClick={() => setOpen(false)}>Close inspector</button>
          <button disabled={disabled} onClick={() => void duplicate()}>
            Duplicate
          </button>
        </>
      );
    }
    render(
      <>
        <AutosaveStatusProvider>
          <Workspace />
        </AutosaveStatusProvider>
        <OtherCopyActions />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("button", { name: /^Duplicate$/u })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Close inspector" }));
    await waitFor(() => expect(update.called).toBe(true));
    expect(screen.getByRole("button", { name: /^Duplicate$/u })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicate other chart" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Duplicate in other experiment" })).toBeEnabled();
    resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Duplicate$/u })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /^Duplicate$/u }));
    await waitFor(() => expect(create.body).toMatchObject({ name: "Updated growth (copy)" }));
  });

  it.each([
    ["a".repeat(255), "a".repeat(248)],
    ["a".repeat(247) + "🌱" + "a".repeat(6), "a".repeat(247)],
    ["a".repeat(246) + "🌱" + "a".repeat(7), "a".repeat(246) + "🌱"],
  ])("keeps a maximum-length chart name within the create limit (%#)", async (longName, prefix) => {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: { ...source, name: longName },
    });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: source,
    });
    const { result } = renderHook(() => useExperimentVisualizationDuplicate("exp-1", source.id));
    await act(async () => {
      await result.current.duplicate();
    });
    expect(create.body).toMatchObject({ name: `${prefix} (copy)` });
  });
});
