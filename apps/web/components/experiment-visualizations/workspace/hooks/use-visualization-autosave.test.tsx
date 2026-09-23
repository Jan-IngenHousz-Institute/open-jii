import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, fireEvent, render, screen, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { AutosaveIndicator } from "../../../shared/autosave/autosave-indicator";
import { AutosaveStatusProvider } from "../../../shared/autosave/autosave-status-context";
import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { useVisualizationAutosave } from "./use-visualization-autosave";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

function Wrapper({ enabled, children }: { enabled?: boolean; children: ReactNode }) {
  const form = useForm<ChartFormValues>({ defaultValues: defaults() });
  return (
    <AutosaveStatusProvider>
      <FormProvider {...form}>
        <Inner form={form} enabled={enabled}>
          {children}
        </Inner>
      </FormProvider>
    </AutosaveStatusProvider>
  );
}

function Inner({
  form,
  enabled,
  children,
}: {
  form: ReturnType<typeof useForm<ChartFormValues>>;
  enabled?: boolean;
  children: ReactNode;
}) {
  useVisualizationAutosave({ form, experimentId: "exp-1", visualizationId: "viz-1", enabled });

  const rename = () => form.setValue("name", "Renamed");

  return (
    <>
      <button type="button" onClick={rename}>
        rename
      </button>
      {children}
    </>
  );
}

describe("useVisualizationAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts without firing a save on the initial form value", () => {
    const spy = server.mount(contract.experiments.updateExperimentVisualization, {
      status: 200,
      body: createVisualization({ id: "viz-1" }),
    });

    render(
      <Wrapper>
        <div />
      </Wrapper>,
    );
    expect(spy.called).toBe(false);
  });

  it("saves an edit", async () => {
    const spy = server.mount(contract.experiments.updateExperimentVisualization, {
      status: 200,
      body: createVisualization({ id: "viz-1" }),
    });

    render(
      <Wrapper>
        <div />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    await act(() => vi.advanceTimersByTimeAsync(1500));

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("neither saves nor reports a status while disabled", async () => {
    const spy = server.mount(contract.experiments.updateExperimentVisualization, {
      status: 200,
      body: createVisualization({ id: "viz-1" }),
    });

    render(
      <Wrapper enabled={false}>
        <AutosaveIndicator />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    await act(() => vi.advanceTimersByTimeAsync(1500));

    expect(spy.called).toBe(false);
    expect(screen.queryByText("autosave.saved")).not.toBeInTheDocument();
  });
});
