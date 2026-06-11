import { AutosaveStatusProvider } from "@/shared/ui/autosave/autosave-status-context";
import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

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

function Wrapper({ children }: { children: ReactNode }) {
  const form = useForm<ChartFormValues>({ defaultValues: defaults() });
  return (
    <AutosaveStatusProvider>
      <FormProvider {...form}>
        <Inner form={form}>{children}</Inner>
      </FormProvider>
    </AutosaveStatusProvider>
  );
}

function Inner({
  form,
  children,
}: {
  form: ReturnType<typeof useForm<ChartFormValues>>;
  children: ReactNode;
}) {
  useVisualizationAutosave({ form, experimentId: "exp-1", visualizationId: "viz-1" });
  return <>{children}</>;
}

describe("useVisualizationAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
});
