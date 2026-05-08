import { createExperimentDataTable, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useForm, FormProvider } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import type { ChartFormValues } from "../charts/form-values";
import { lineChartType } from "../charts/line";
import { scatterChartType } from "../charts/scatter";
import { VisualizationSaveProvider } from "./save-context";
import { VisualizationWorkspace } from "./visualization-workspace";

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

function Harness({ formDefaults = defaults() }: { formDefaults?: ChartFormValues } = {}) {
  const form = useForm<ChartFormValues>({ defaultValues: formDefaults });
  return (
    <FormProvider {...form}>
      <VisualizationSaveProvider>
        <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
      </VisualizationSaveProvider>
    </FormProvider>
  );
}

function mountTablesAndData(tableNames: string[] = ["readings"]) {
  server.mount(contract.experiments.getExperimentTables, {
    // Pin displayName so tests don't depend on the factory's module-scoped
    // sequence counter (other tests in the same worker bump it).
    body: tableNames.map((identifier) =>
      createExperimentTable({ identifier, displayName: identifier }),
    ),
  });
  server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        data: {
          columns: [
            { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      }),
    ],
  });
}

describe("VisualizationWorkspace", () => {
  it("renders the chart-type picker, the canvas area, and the inspector by default", async () => {
    mountTablesAndData();
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }),
    ).toBeInTheDocument();

    // Wait for the inspector to swap from the loading card to the dataset
    // section. The "dataset" string appears as both a heading and an
    // sr-only FormLabel — query the heading so the assertion is precise.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
      ).toBeInTheDocument(),
    );
  });

  it("collapses the inspector when the panel toggle is clicked", async () => {
    mountTablesAndData();
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "workspace.inspector.collapse" }));
    expect(
      screen.queryByRole("heading", { name: "workspace.inspector.dataset" }),
    ).not.toBeInTheDocument();

    // Re-expand and the dataset section comes back.
    await user.click(screen.getByRole("button", { name: "workspace.inspector.expand" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
      ).toBeInTheDocument(),
    );
  });

  it("switches chart types directly when the form has no meaningful column picks", async () => {
    mountTablesAndData();
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;

    function CaptureHarness() {
      formRef = useForm<ChartFormValues>({ defaultValues: defaults() });
      return (
        <FormProvider {...formRef}>
          <VisualizationSaveProvider>
            <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
          </VisualizationSaveProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness />);

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(
      await screen.findByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    );

    expect(formRef.getValues("chartType")).toBe("scatter");
    // No confirm dialog appeared.
    expect(screen.queryByText("workspace.charts.switchConfirmTitle")).not.toBeInTheDocument();
  });

  it("opens a confirm dialog before switching chart types when columns have been picked", async () => {
    mountTablesAndData();
    const user = userEvent.setup();
    render(
      <Harness
        formDefaults={defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
            ],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(
      await screen.findByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    );

    expect(await screen.findByText("workspace.charts.switchConfirmTitle")).toBeInTheDocument();
  });

  it("applies the pending chart type when the confirm button is pressed", async () => {
    mountTablesAndData();
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;

    function CaptureHarness() {
      formRef = useForm<ChartFormValues>({
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [{ tableName: "readings", columnName: "time", role: "x" }],
          },
        }),
      });
      return (
        <FormProvider {...formRef}>
          <VisualizationSaveProvider>
            <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
          </VisualizationSaveProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness />);

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(
      await screen.findByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    );
    await user.click(await screen.findByRole("button", { name: "workspace.charts.switchConfirm" }));

    expect(formRef.getValues("chartType")).toBe("scatter");
    expect(formRef.getValues("chartFamily")).toBe(scatterChartType.family);
  });

  it("dismisses the confirm dialog without changing the chart type when cancelled", async () => {
    mountTablesAndData();
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;

    function CaptureHarness() {
      formRef = useForm<ChartFormValues>({
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [{ tableName: "readings", columnName: "time", role: "x" }],
          },
        }),
      });
      return (
        <FormProvider {...formRef}>
          <VisualizationSaveProvider>
            <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
          </VisualizationSaveProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness />);

    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));
    await user.click(
      await screen.findByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    );
    await user.click(await screen.findByRole("button", { name: /ui\.actions\.back/ }));

    expect(formRef.getValues("chartType")).toBe("line");
    await waitFor(() =>
      expect(screen.queryByText("workspace.charts.switchConfirmTitle")).not.toBeInTheDocument(),
    );
  });

  it("clears each data source's columnName + alias when the user picks a new table", async () => {
    mountTablesAndData(["readings", "events"]);
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;

    function CaptureHarness() {
      formRef = useForm<ChartFormValues>({
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x", alias: "Time" },
              { tableName: "readings", columnName: "temp", role: "y", alias: "Temp" },
            ],
          },
        }),
      });
      return (
        <FormProvider {...formRef}>
          <VisualizationSaveProvider>
            <VisualizationWorkspace experimentId="exp-1" visualizationId="viz-1" />
          </VisualizationSaveProvider>
        </FormProvider>
      );
    }

    render(<CaptureHarness />);

    // Wait for the dataset section to render (tables resolved). The first
    // combobox is the dataset Select; the others are the per-axis column
    // pickers further down the inspector.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
      ).toBeInTheDocument(),
    );
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    // Pick the OTHER table by its identifier (factory's displayName is
    // pinned to the identifier in `mountTablesAndData`).
    await user.click(await screen.findByText("events"));

    const sources = formRef.getValues("dataConfig.dataSources");
    expect(sources.every((s) => s.columnName === "")).toBe(true);
    expect(sources.every((s) => s.alias === "")).toBe(true);
    expect(formRef.getValues("config.xAxisTitle")).toBe("");
    expect(formRef.getValues("config.yAxisTitle")).toBe("");
  });
});
