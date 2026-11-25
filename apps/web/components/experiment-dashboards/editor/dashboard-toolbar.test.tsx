import {
  createExperimentDashboard,
  createTableWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, assertExists, render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { AutosaveStatusProvider } from "../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardAutosaveBoundary } from "./context/dashboard-copy-save-context";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import DashboardToolbar from "./dashboard-toolbar";
import { useDeselectOnOutsideClick } from "./hooks/use-deselect-on-outside-click";

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
  save = false,
  canEdit = true,
}: {
  children: ReactNode;
  initialWidgets?: ExperimentDashboardWidget[];
  save?: boolean;
  canEdit?: boolean;
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
      <DashboardEditorProvider>
        {save ? (
          <AutosaveStatusProvider>
            <DashboardAutosaveBoundary
              form={form}
              experimentId="exp-1"
              dashboardId="dash-1"
              enabled={canEdit}
            >
              {children}
            </DashboardAutosaveBoundary>
          </AutosaveStatusProvider>
        ) : (
          children
        )}
      </DashboardEditorProvider>
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
  it("selects a same-size copy and retries the compacted dashboard save without creating another chart", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source", name: "Growth" });
    const created = createVisualization({ id: "copy", name: "Growth (copy)" });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
    });
    vi.mocked(toast).mockReturnValue({ id: "copy-error", dismiss: vi.fn(), update: vi.fn() });
    const failed = server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const below = createTableWidget({ layout: { col: 0, row: 4, colSpan: 6, rowSpan: 4 } });
    const beside = createTableWidget({ layout: { col: 6, row: 0, colSpan: 6, rowSpan: 4 } });
    const belowBeside = createTableWidget({ layout: { col: 6, row: 4, colSpan: 6, rowSpan: 4 } });
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
      <Harness initialWidgets={[chart, below, beside, belowBeside]} save>
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
    expect(state.widgets.find((widget) => widget.id === chart.id)).toEqual(chart);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "editor.inspector.copySaveFailed",
        }),
      ),
    );
    expect(failed.callCount).toBe(1);

    const resumed = server.mount(contract.experiments.updateExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-1" }),
    });
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    expect(
      screen.queryByRole("menuitem", { name: "editor.inspector.duplicate" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.retryCopySave" }));

    await waitFor(() =>
      expect(resumed.body).toMatchObject({
        widgets: [
          chart,
          { ...below, layout: { ...below.layout, row: 8 } },
          beside,
          belowBeside,
          copy,
        ],
      }),
    );
    expect(resumed.body).toEqual(failed.body);
    expect(resumed.callCount).toBe(1);
    expect(create.callCount).toBe(1);
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" })).toBeEnabled(),
    );
  });

  it("places and selects the copy even if Escape unmounts the toolbar while create is pending", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    const { promise, resolve } = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
      unblock: promise,
    });
    const update = server.mount(contract.experiments.updateExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-1" }),
    });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });

    function Canvas() {
      const editor = useDashboardEditor();
      useDeselectOnOutsideClick(editor);
      const { control } = useFormContext<DashboardFormValues>();
      const widgets = useWatch({ name: "widgets", control });
      const selected = widgets.find((widget) => widget.id === editor.selectedWidgetId);
      return (
        <>
          <button data-dashboard-widget="" onClick={() => editor.selectWidget(chart.id)}>
            select chart
          </button>
          {selected?.type === "visualization" && (
            <output aria-label="Selected chart">{selected.config.visualizationId}</output>
          )}
          {editor.selectedWidgetId && <DashboardToolbar visible experimentId="exp-1" />}
        </>
      );
    }

    render(
      <Harness initialWidgets={[chart]} save>
        <Canvas />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() => expect(create.called).toBe(true));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "editor.inspector.more" })).not.toBeInTheDocument();
    act(() => resolve());

    await waitFor(() =>
      expect(screen.getByLabelText("Selected chart")).toHaveTextContent(created.id),
    );
    await waitFor(() => expect(update.called).toBe(true));
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "editor.inspector.copyNotAttached" }),
    );
  });

  it("offers a link to the saved copy if the source widget disappears before create finishes", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source", name: "Growth" });
    const created = createVisualization({ id: "copy", name: "Growth (copy)" });
    const { promise, resolve } = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
      unblock: promise,
    });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    server.mount(contract.experiments.updateExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-1" }),
    });

    function SelectSource() {
      const { selectWidget } = useDashboardEditor();
      return <button onClick={() => selectWidget(chart.id)}>select chart</button>;
    }
    render(
      <Harness initialWidgets={[chart]} save>
        <SelectSource />
        <DashboardToolbar visible experimentId="exp-1" />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "select chart" }));
    const more = screen.getByRole("button", { name: "editor.inspector.more" });
    await user.click(more);
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() => expect(create.called).toBe(true));
    await user.click(more);
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.delete" }));
    act(() => resolve());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "editor.inspector.copyNotAttached",
        }),
      ),
    );

    const action = vi
      .mocked(toast)
      .mock.calls.find(([value]) => value.title === "editor.inspector.copyNotAttached")?.[0].action;
    assertExists(action);
    expect(action.props).toMatchObject({
      children: {
        props: { href: "/en-US/platform/experiments/exp-1/analysis/visualizations/copy" },
      },
    });
  });
  it("dismisses copy recovery and hides retry when dashboard editing is revoked", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    server.mount(contract.experiments.createExperimentVisualization, { body: created });
    const update = server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });
    const dismiss = vi.fn();
    vi.mocked(toast).mockReturnValue({ id: "copy-error", dismiss, update: vi.fn() });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    function SelectSource() {
      const { selectWidget } = useDashboardEditor();
      return <button onClick={() => selectWidget(chart.id)}>select chart</button>;
    }
    function dashboard(canEdit: boolean) {
      return (
        <Harness initialWidgets={[chart]} save canEdit={canEdit}>
          <SelectSource />
          <DashboardToolbar visible experimentId="exp-1" />
        </Harness>
      );
    }

    const { rerender } = render(dashboard(true));
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "editor.inspector.copySaveFailed",
        }),
      ),
    );

    rerender(dashboard(false));
    expect(dismiss).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    expect(screen.getByRole("menuitem", { name: "editor.inspector.delete" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "editor.inspector.retryCopySave" }),
    ).not.toBeInTheDocument();
    expect(update.callCount).toBe(1);
  });
});
