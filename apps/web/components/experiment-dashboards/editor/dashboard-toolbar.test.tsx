import {
  createExperimentDashboard,
  createTableWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import {
  assertExists,
  createTestQueryClient,
  render,
  renderWithForm,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { AutosaveStatusProvider } from "../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import DashboardToolbar from "./dashboard-toolbar";
import { useDashboardAutosave } from "./hooks/use-dashboard-autosave";

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

function ChartSelection({ chartId }: { chartId: string }) {
  const { selectWidget, selectedWidgetId } = useDashboardEditor();
  return (
    <>
      <button onClick={() => selectWidget(chartId)}>select chart</button>
      <button onClick={() => selectWidget(null)}>clear selection</button>
      {selectedWidgetId && <DashboardToolbar visible experimentId="exp-1" />}
    </>
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
  it.each(["kept", "cleared", "restored"])("saves one copy, selection %s", async (selection) => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source", name: "Growth" });
    const created = createVisualization({ id: "copy", name: "Growth (copy)" });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const { promise, resolve } = Promise.withResolvers<void>();
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
      unblock: promise,
    });
    const save = server.mount(contract.experiments.updateExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-1" }),
    });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const below = createTableWidget({ layout: { col: 0, row: 4, colSpan: 6, rowSpan: 4 } });
    const beside = createTableWidget({ layout: { col: 6, row: 0, colSpan: 6, rowSpan: 4 } });
    const belowBeside = createTableWidget({ layout: { col: 6, row: 4, colSpan: 6, rowSpan: 4 } });
    function State() {
      const form = useFormContext<DashboardFormValues>();
      useDashboardAutosave({ form, experimentId: "exp-1", dashboardId: "dash-1" });
      const widgets = useWatch({ control: form.control, name: "widgets" });
      const { selectedWidgetId } = useDashboardEditor();
      return (
        <>
          <ChartSelection chartId={chart.id} />
          <output>{JSON.stringify({ widgets, selectedWidgetId })}</output>
        </>
      );
    }
    render(
      <AutosaveStatusProvider>
        <Harness initialWidgets={[chart, below, beside, belowBeside]}>
          <State />
        </Harness>
      </AutosaveStatusProvider>,
    );
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    try {
      await waitFor(() => expect(create.called).toBe(true));
      if (selection !== "kept") {
        await user.click(screen.getByRole("button", { name: "clear selection" }));
        expect(
          screen.queryByRole("button", { name: "editor.inspector.more" }),
        ).not.toBeInTheDocument();
      }
      if (selection === "restored") {
        await user.click(screen.getByRole("button", { name: "select chart" }));
        await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
        const duplicate = screen.getByRole("menuitem", { name: "editor.inspector.duplicate" });
        expect.soft(duplicate).toHaveAttribute("aria-disabled", "true");
        await user.click(duplicate);
        await user.keyboard("{Escape}");
      }
    } finally {
      resolve();
    }
    await waitFor(
      () => expect(screen.getByRole("status")).toHaveTextContent('"visualizationId":"copy"'),
      { timeout: 2_000 },
    );
    const state = JSON.parse(screen.getByRole("status").textContent) as {
      widgets: ExperimentDashboardWidget[];
      selectedWidgetId: string;
    };
    const copy = state.widgets.find((widget) => widget.id === state.selectedWidgetId);
    expect(copy).toMatchObject({
      type: "visualization",
      layout: { ...chart.layout, row: 4 },
      config: { ...chart.config, visualizationId: "copy" },
    });
    await waitFor(
      () =>
        expect(save.body).toMatchObject({
          widgets: [
            chart,
            { ...below, layout: { ...below.layout, row: 8 } },
            beside,
            belowBeside,
            copy,
          ],
        }),
      { timeout: 3_000 },
    );
    expect(create.callCount).toBe(1);
    expect(save.callCount).toBe(1);
  });

  it("leaves the form untouched when a chart copy arrives after the dashboard unmounts", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const { promise, resolve } = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
      unblock: promise,
    });
    const save = server.mount(contract.experiments.updateExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-1" }),
    });
    function Editor() {
      const form = useFormContext<DashboardFormValues>();
      useDashboardAutosave({ form, experimentId: "exp-1", dashboardId: "dash-1" });
      return <ChartSelection chartId={chart.id} />;
    }

    const { name, layout } = createExperimentDashboard();
    const { form, unmount } = renderWithForm<DashboardFormValues>(
      () => (
        <DashboardEditorProvider>
          <Editor />
        </DashboardEditorProvider>
      ),
      { queryClient, useFormProps: { defaultValues: { name, layout, widgets: [chart] } } },
    );
    const consoleError = vi.spyOn(console, "error");
    try {
      await user.click(screen.getByRole("button", { name: "select chart" }));
      await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
      await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
      await waitFor(() => expect(create.callCount).toBe(1));
      const [creation] = queryClient.getMutationCache().getAll();
      assertExists(creation);
      unmount();
      resolve();
      await waitFor(() => expect(creation.state.status).toBe("success"));
      expect(form.getValues("widgets")).toEqual([chart]);
      expect(save.callCount).toBe(0);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      resolve();
      consoleError.mockRestore();
    }
  });
});
