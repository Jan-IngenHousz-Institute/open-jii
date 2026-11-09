import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, fireEvent, render, screen, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import * as translations from "@repo/i18n";

import german from "../../../../../../packages/i18n/locales/de-DE/experimentVisualizations.json";
import { AutosaveIndicator } from "../../../shared/autosave/autosave-indicator";
import { AutosaveStatusProvider } from "../../../shared/autosave/autosave-status-context";
import { lineChartType } from "../../charts/basic/line";
import { chartFormResolver } from "../../charts/chart-config";
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
  const { t } = translations.useTranslation("experimentVisualizations");
  const form = useForm<ChartFormValues>({
    defaultValues: defaults(),
    resolver: chartFormResolver,
    mode: "onChange",
    context: { translate: t },
  });
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
      <button
        type="button"
        onClick={() =>
          form.setValue("dataConfig.join", {
            tableName: "weather",
            matchColumn: "",
            primaryTimeColumn: "",
            secondaryTimeColumn: "",
            toleranceMinutes: 5,
          })
        }
      >
        draft join
      </button>
      <button
        type="button"
        onClick={() =>
          form.setValue("dataConfig.join", {
            tableName: "weather",
            matchColumn: "station",
            primaryTimeColumn: "timestamp",
            secondaryTimeColumn: "timestamp",
            toleranceMinutes: 5,
          })
        }
      >
        complete join
      </button>
      <button
        type="button"
        onClick={() => {
          form.setValue("dataConfig.dataSources", [
            { tableName: "t", columnName: "time", role: "x" },
            { tableName: "t", columnName: "value", role: "y", aggregate: "previous" },
          ]);
        }}
      >
        incomplete window
      </button>
      <button
        type="button"
        onClick={() => form.setValue("dataConfig.dataSources.1.orderColumn", "time")}
      >
        complete window
      </button>
      <button
        type="button"
        onClick={() =>
          form.setValue("dataConfig.aggregation", {
            groupBy: [{ column: "time", timeBucket: "hour" }],
          })
        }
      >
        bucket window
      </button>
      <button type="button" onClick={() => form.setValue("dataConfig.aggregation", undefined)}>
        remove bucket
      </button>
      {form.formState.errors.dataConfig?.dataSources?.[1]?.orderColumn && (
        <p role="alert">{form.formState.errors.dataConfig.dataSources[1].orderColumn.message}</p>
      )}
      {form.formState.errors.dataConfig?.dataSources?.[1]?.aggregate && (
        <p role="alert">{form.formState.errors.dataConfig.dataSources[1].aggregate.message}</p>
      )}
      <button
        type="button"
        onClick={() => form.setValue("dataConfig.dataSources.1.partitionColumn", "  ")}
      >
        invalid per
      </button>
      <button type="button" onClick={() => form.setValue("name", "")}>
        empty name
      </button>
      <button
        type="button"
        onClick={() =>
          form.setValue("dataConfig.filters", [
            { column: "", operator: "equals", value: "" },
            { column: "temp", operator: "between", value: [1] },
          ])
        }
      >
        invalid filter after draft
      </button>
      {form.formState.errors.name && <p role="alert">{form.formState.errors.name.message}</p>}
      {form.formState.errors.dataConfig?.dataSources?.[1]?.partitionColumn && (
        <p role="alert">
          {form.formState.errors.dataConfig.dataSources[1].partitionColumn.message}
        </p>
      )}
      {form.formState.errors.dataConfig?.filters?.message && (
        <p role="alert">{form.formState.errors.dataConfig.filters.message}</p>
      )}
      <output data-testid="filter-errors">
        {JSON.stringify(form.formState.errors.dataConfig?.filters)}
      </output>
      {children}
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("useVisualizationAutosave", () => {
  it("holds incomplete join edits and saves once every matching field is complete", async () => {
    const spy = server.mount(contract.experiments.updateExperimentVisualization, {
      status: 200,
      body: createVisualization({ id: "viz-1" }),
    });
    render(
      <Wrapper>
        <div />
      </Wrapper>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "draft join" }));
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(spy.called).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "complete join" }));
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      dataConfig: { join: { tableName: "weather", matchColumn: "station", toleranceMinutes: 5 } },
    });
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("holds incomplete windows and invalid bucket mixes with visible errors, then resumes saving", async () => {
    const spy = server.mount(contract.experiments.updateExperimentVisualization, {
      body: createVisualization({ id: "viz-1" }),
    });
    render(
      <Wrapper>
        <div />
      </Wrapper>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "incomplete window" }));
      await Promise.resolve();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "workspace.shelves.windowOrderRequired",
    );
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(spy.called).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "complete window" }));
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(spy.callCount).toBe(1));
    expect(spy.body).toMatchObject({
      dataConfig: { aggregation: { functions: [{ function: "previous", orderColumn: "time" }] } },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "bucket window" }));
      await Promise.resolve();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "workspace.shelves.rowWindowConflict",
    );
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(spy.callCount).toBe(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "rename" }));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "remove bucket" }));
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(spy.callCount).toBe(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "rename" }));
      await Promise.resolve();
    });
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
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "rename" }));
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1500));

    expect(spy.called).toBe(false);
    expect(screen.queryByText("autosave.saved")).not.toBeInTheDocument();
  });
});

it("translates Ordered by, Per and required names into German", async () => {
  const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
  const i18n = createInstance();
  await i18n.init({
    lng: "de-DE",
    defaultNS: "experimentVisualizations",
    resources: { "de-DE": { experimentVisualizations: german } },
    interpolation: { escapeValue: false },
  });
  vi.spyOn(translations, "useTranslation").mockImplementation(
    (ns = "experimentVisualizations", options = {}) => useTranslation(ns, options),
  );
  render(
    <I18nextProvider i18n={i18n}>
      <Wrapper>
        <div />
      </Wrapper>
    </I18nextProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "incomplete window" }));
    await Promise.resolve();
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    german.workspace.shelves.windowOrderRequired,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "complete window" }));
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "invalid per" }));
    await Promise.resolve();
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    german.workspace.shelves.windowPerInvalid,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "empty name" }));
    await Promise.resolve();
  });
  expect(await screen.findByText(german.workspace.validation.nameRequired)).toBeInTheDocument();
  vi.restoreAllMocks();
});

it("reports sanitized filter failures at the section instead of a shifted form row", async () => {
  render(
    <Wrapper>
      <div />
    </Wrapper>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "invalid filter after draft" }));
    await Promise.resolve();
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("workspace.validation.invalidFilters");
  expect(screen.getByTestId("filter-errors")).toHaveTextContent('"type":"custom"');
  expect(screen.getByTestId("filter-errors")).not.toHaveTextContent('"0"');
});
