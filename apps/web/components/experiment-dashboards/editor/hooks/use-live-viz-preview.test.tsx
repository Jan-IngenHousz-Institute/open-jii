import { render, screen, userEvent } from "@/test/test-utils";
import { renderHook as rtlRenderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../../experiment-visualizations/charts/basic/line";
import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { LiveVizProvider, useLiveViz } from "../context/live-viz-context";
import { useLiveVizPreview } from "./use-live-viz-preview";

function Wrapper({ children }: { children: ReactNode }) {
  return <LiveVizProvider>{children}</LiveVizProvider>;
}

function makeDefaults(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

interface Harness {
  live: ReturnType<typeof useLiveViz>;
}

function setupHook(visualizationId = "viz-1") {
  return rtlRenderHook<Harness, void>(
    () => {
      const form = useForm<ChartFormValues>({ defaultValues: makeDefaults() });
      useLiveVizPreview(form, visualizationId);
      const live = useLiveViz();
      return { live };
    },
    { wrapper: Wrapper },
  );
}

// Real input changes fire watch with info.type === "change"; bare setValue
// fires with type undefined, which the hook intentionally ignores.
function NameInputHarness({ visualizationId = "viz-1" }: { visualizationId?: string }) {
  const form = useForm<ChartFormValues>({ defaultValues: makeDefaults() });
  useLiveVizPreview(form, visualizationId);
  const live = useLiveViz();
  return (
    <>
      <input aria-label="name" {...form.register("name")} />
      <output data-testid="live-name">{live?.values.name ?? ""}</output>
    </>
  );
}

describe("useLiveVizPreview", () => {
  it("publishes initial form values on mount under the supplied visualizationId", () => {
    const { result } = setupHook("viz-42");
    expect(result.current.live?.vizId).toBe("viz-42");
    expect(result.current.live?.values.name).toBe("Untitled");
  });

  it("re-publishes the latest values when a form field changes", async () => {
    const user = userEvent.setup();
    render(
      <LiveVizProvider>
        <NameInputHarness />
      </LiveVizProvider>,
    );
    const input = screen.getByLabelText("name");
    await user.clear(input);
    await user.type(input, "edited");
    expect(screen.getByTestId("live-name")).toHaveTextContent("edited");
  });

  it("publishes via the form watch subscription on subsequent edits (not just initial)", async () => {
    const user = userEvent.setup();
    render(
      <LiveVizProvider>
        <NameInputHarness />
      </LiveVizProvider>,
    );
    const input = screen.getByLabelText("name");
    await user.clear(input);
    await user.type(input, "first edit");
    await user.clear(input);
    await user.type(input, "second edit");
    expect(screen.getByTestId("live-name")).toHaveTextContent("second edit");
  });
});
