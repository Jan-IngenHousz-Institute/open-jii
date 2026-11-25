import {
  createTableWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import DashboardToolbar from "./dashboard-toolbar";

vi.mock("./inspector-toolbar/strips/table-widget-strip", () => ({
  TableWidgetStrip: () => <div data-testid="table-widget-strip" />,
}));
vi.mock("./inspector-toolbar/strips/table-data-strip", () => ({
  TableDataStrip: () => <div data-testid="table-data-strip" />,
}));
vi.mock("./inspector-toolbar/strips/visualization-strips-host", () => ({
  VisualizationStripsHost: () => null,
}));
vi.mock("./inspector-toolbar/strips/visualization-widget-strip", () => ({
  VisualizationWidgetStrip: () => null,
}));

const first = createTableWidget();
const second = createTableWidget();

function Harness({
  children,
  initialWidgets = [first, second],
}: {
  children: ReactNode;
  initialWidgets?: ExperimentDashboardWidget[];
}) {
  const form = useForm<DashboardFormValues>({
    defaultValues: {
      name: "Dashboard",
      description: "",
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: initialWidgets,
    },
  });
  return (
    <FormProvider {...form}>
      <DashboardEditorProvider>{children}</DashboardEditorProvider>
    </FormProvider>
  );
}

function SelectButtons() {
  const { selectWidget } = useDashboardEditor();
  return (
    <>
      <button type="button" onClick={() => selectWidget(first.id)}>
        select first
      </button>
      <button type="button" onClick={() => selectWidget(second.id)}>
        select second
      </button>
    </>
  );
}

function renderToolbar() {
  return render(
    <Harness>
      <SelectButtons />
      <DashboardToolbar visible experimentId="exp-1" />
    </Harness>,
  );
}

describe("DashboardToolbar", () => {
  it("keeps the chosen section while the same widget stays selected", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "select first" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.tabs.data" }));
    await user.click(screen.getByRole("button", { name: "select first" }));

    expect(screen.getByRole("button", { name: "editor.inspector.tabs.data" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("table-data-strip")).toBeInTheDocument();
  });

  it("returns to the widget section when another widget is selected", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "select first" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.tabs.data" }));
    await user.click(screen.getByRole("button", { name: "select second" }));

    expect(screen.getByRole("button", { name: "editor.inspector.tabs.widget" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("table-widget-strip")).toBeInTheDocument();
  });
  it("inserts a separate same-size chart below the original and selects it", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source", name: "Growth" });
    const created = createVisualization({ id: "copy", name: "Growth (copy)" });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    server.mount(contract.experiments.createExperimentVisualization, { body: created });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const below = createTableWidget({ layout: { col: 0, row: 4, colSpan: 6, rowSpan: 4 } });
    function State() {
      const form = useFormContext<DashboardFormValues>();
      const widgets = useWatch({ control: form.control, name: "widgets" });
      const { selectWidget, selectedWidgetId } = useDashboardEditor();
      return (
        <>
          <button onClick={() => selectWidget(chart.id)}>select chart</button>
          <output>{JSON.stringify({ widgets, selectedWidgetId })}</output>
        </>
      );
    }
    render(
      <Harness initialWidgets={[chart, below]}>
        <State />
        <DashboardToolbar visible experimentId="exp-1" />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent('"visualizationId":"copy"'),
    );
    const state = JSON.parse(screen.getByRole("status").textContent ?? "{}") as {
      widgets: ExperimentDashboardWidget[];
      selectedWidgetId: string;
    };
    const copy = state.widgets.find((widget) => widget.id === state.selectedWidgetId);
    expect(copy).toMatchObject({
      type: "visualization",
      layout: { ...chart.layout, row: 4 },
      config: { ...chart.config, visualizationId: "copy" },
    });
    expect(state.widgets.find((widget) => widget.id === chart.id)).toEqual(chart);
    expect(state.widgets.find((widget) => widget.id === below.id)?.layout.row).toBe(8);
  });
});
