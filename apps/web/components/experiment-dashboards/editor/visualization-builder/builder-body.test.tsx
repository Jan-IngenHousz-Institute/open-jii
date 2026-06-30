import { createExperimentDataTable, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ReactElement, ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { lineChartType } from "../../../experiment-visualizations/charts/basic/line";
import { scatterChartType } from "../../../experiment-visualizations/charts/basic/scatter";
import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../../../experiment-visualizations/workspace/context/data-sources-field-array-context";
import { BuilderBody } from "./builder-body";

type RenderFn = (form: UseFormReturn<ChartFormValues>) => ReactElement;
type Opts = Parameters<typeof renderWithForm<ChartFormValues>>[1];

function renderInProvider(render: RenderFn, options: Opts) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>{render(form)}</DataSourcesFieldArrayProvider>
    ),
    options,
  );
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

interface SetupOpts {
  renderWidgetTab?: (chartTypePicker: ReactNode) => ReactNode;
}

function setup({ renderWidgetTab = () => <div>widget-pane</div> }: SetupOpts = {}) {
  server.mount(orpcContract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: "raw_data", displayName: "Raw data" })],
  });

  return renderInProvider(
    () => <BuilderBody experimentId="exp-1" renderWidgetTab={renderWidgetTab} />,
    { useFormProps: { defaultValues: makeDefaults() } },
  );
}

describe("BuilderBody", () => {
  it("renders the three tabs labelled widget, data, style", () => {
    setup();
    expect(screen.getByRole("tab", { name: /editor.inspector.tabs.widget/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /workspace.inspector.tabs.data/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /workspace.inspector.tabs.style/ })).toBeInTheDocument();
  });

  it("opens with the widget tab active and renders the supplied widget pane", () => {
    setup({ renderWidgetTab: () => <div>my-widget-pane</div> });
    expect(screen.getByRole("tab", { name: /editor.inspector.tabs.widget/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("my-widget-pane")).toBeInTheDocument();
  });

  it("switches to the data tab on click and hides the widget pane", async () => {
    const user = userEvent.setup();
    setup({ renderWidgetTab: () => <div>my-widget-pane</div> });

    await user.click(screen.getByRole("tab", { name: /workspace.inspector.tabs.data/ }));
    expect(screen.getByRole("tab", { name: /workspace.inspector.tabs.data/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("forwards the chart type picker into the widget tab slot via renderWidgetTab", () => {
    setup({
      renderWidgetTab: (chartTypePicker: ReactNode) => (
        <div>
          <span>my-widget-pane</span>
          {chartTypePicker}
        </div>
      ),
    });
    // The chart type picker exposes the currently picked type label.
    expect(screen.getByText("my-widget-pane")).toBeInTheDocument();
  });

  it("switches the chart type immediately when no meaningful data config exists", async () => {
    const user = userEvent.setup();
    // renderWidgetTab needs to actually render the picker for the user to click.
    const { form } = setup({ renderWidgetTab: (picker) => <div>{picker}</div> });

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(await screen.findByRole("button", { name: scatterChartType.labelKey }));

    await waitFor(() => expect(form.getValues("chartType")).toBe(scatterChartType.type));
    expect(screen.queryByText("workspace.charts.switchConfirmTitle")).not.toBeInTheDocument();
  });

  it("opens the confirm dialog before switching when the existing config has data", async () => {
    const user = userEvent.setup();
    const defaults: ChartFormValues = {
      ...makeDefaults(),
      dataConfig: {
        tableName: "raw_data",
        dataSources: [
          { tableName: "raw_data", columnName: "time", role: "x" },
          { tableName: "raw_data", columnName: "temp", role: "y" },
        ],
      },
    };
    server.mount(orpcContract.experiments.getExperimentTables, {
      body: [createExperimentTable({ identifier: "raw_data", displayName: "Raw" })],
    });
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });
    const { form } = renderInProvider(
      () => <BuilderBody experimentId="exp-1" renderWidgetTab={(picker) => <div>{picker}</div>} />,
      { useFormProps: { defaultValues: defaults } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(await screen.findByRole("button", { name: scatterChartType.labelKey }));

    expect(await screen.findByText("workspace.charts.switchConfirmTitle")).toBeInTheDocument();
    expect(form.getValues("chartType")).toBe(lineChartType.type);

    await user.click(screen.getByRole("button", { name: "workspace.charts.switchConfirm" }));

    await waitFor(() => expect(form.getValues("chartType")).toBe(scatterChartType.type));
  });

  it("keeps the existing chart type when the user cancels the switch dialog", async () => {
    const user = userEvent.setup();
    const defaults: ChartFormValues = {
      ...makeDefaults(),
      dataConfig: {
        tableName: "raw_data",
        dataSources: [{ tableName: "raw_data", columnName: "time", role: "x" }],
      },
    };
    server.mount(orpcContract.experiments.getExperimentTables, {
      body: [createExperimentTable({ identifier: "raw_data", displayName: "Raw" })],
    });
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });
    const { form } = renderInProvider(
      () => <BuilderBody experimentId="exp-1" renderWidgetTab={(picker) => <div>{picker}</div>} />,
      { useFormProps: { defaultValues: defaults } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(await screen.findByRole("button", { name: scatterChartType.labelKey }));

    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(form.getValues("chartType")).toBe(lineChartType.type);
    expect(screen.queryByText("workspace.charts.switchConfirmTitle")).not.toBeInTheDocument();
  });

  it("resets dataSources and axis titles when the user picks a different table on the data tab", async () => {
    const user = userEvent.setup();
    const defaults: ChartFormValues = {
      ...makeDefaults(),
      config: { ...makeDefaults().config, xAxisTitle: "Time", yAxisTitle: "Temp" },
      dataConfig: {
        tableName: "raw_data",
        dataSources: [{ tableName: "raw_data", columnName: "time", role: "x", aggregate: "avg" }],
      },
    };
    server.mount(orpcContract.experiments.getExperimentTables, {
      body: [
        createExperimentTable({ identifier: "raw_data", displayName: "Raw" }),
        createExperimentTable({ identifier: "other_table", displayName: "Other" }),
      ],
    });
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });
    const { form } = renderInProvider(
      () => <BuilderBody experimentId="exp-1" renderWidgetTab={() => <div />} />,
      { useFormProps: { defaultValues: defaults } },
    );

    await user.click(screen.getByRole("tab", { name: /workspace.inspector.tabs.data/ }));
    // The first combobox in the data tab is the table picker.
    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0));
    const tablePicker = screen.getAllByRole("combobox")[0];
    await user.click(tablePicker);
    await user.click(await screen.findByRole("option", { name: /Other/ }));

    await waitFor(() => {
      const sources = form.getValues("dataConfig.dataSources");
      expect(sources[0].tableName).toBe("other_table");
      expect(sources[0].columnName).toBe("");
      expect(sources[0].aggregate).toBeUndefined();
    });
    expect(form.getValues("config.xAxisTitle")).toBe("");
    expect(form.getValues("config.yAxisTitle")).toBe("");
  });
});
