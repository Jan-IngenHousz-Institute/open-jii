import { experimentAccessQueryKey } from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import { orpc } from "@/lib/orpc";
import {
  createExperimentAccess,
  createExperimentDashboard,
  createSession,
  createUseSessionResult,
  createTableWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import {
  act,
  assertExists,
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { authClient, useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { AutosaveStatusProvider } from "../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../dashboard-form-shell";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import { DashboardAutosaveBoundary } from "./dashboard-autosave-boundary";
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

function ChartSelection({ sourceWidgetId }: { sourceWidgetId: string }) {
  const { control } = useFormContext<DashboardFormValues>();
  const widgets = useWatch({ name: "widgets", control });
  const { selectWidget, selectedWidgetId } = useDashboardEditor();
  const charts = widgets.flatMap((widget) =>
    widget.type === "visualization" ? [widget.config.visualizationId] : [],
  );
  return (
    <>
      <button onClick={() => selectWidget(sourceWidgetId)}>select chart</button>
      <output aria-label="Chart IDs">{charts.join(", ")}</output>
      <output aria-label="Selected widget">{selectedWidgetId ?? "none"}</output>
    </>
  );
}

function RenameDashboard() {
  const form = useFormContext<DashboardFormValues>();
  return <button onClick={() => form.setValue("name", "Renamed")}>Rename dashboard</button>;
}

function expectOpenCopyLink(chartId: string, basePath = "experiments") {
  const action = vi
    .mocked(toast)
    .mock.calls.find(([value]) => value.title === "editor.inspector.copyNotAttached")?.[0].action;
  assertExists(action);
  expect(action.props).toMatchObject({
    children: {
      props: { href: `/en-US/platform/${basePath}/exp-1/analysis/visualizations/${chartId}` },
    },
  });
}

const dashboardSession = createSession();

describe("DashboardToolbar", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult({ data: dashboardSession }));
    vi.mocked(authClient.getSession).mockResolvedValue({ data: dashboardSession, error: null });
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: "exp-1", status: "active" },
        isAdmin: true,
      }),
    });
  });

  afterEach(() => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult());
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null });
  });

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

  it.each([
    { leaveDashboard: false, view: "on the dashboard" },
    { leaveDashboard: true, view: "after leaving the dashboard" },
  ])("saves copy removal during the attach PATCH $view", async ({ leaveDashboard }) => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const copy = createVisualization({ id: "copy" });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const { promise, resolve } = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    server.mount(contract.experiments.createExperimentVisualization, { body: copy });
    const savedDashboard = createExperimentDashboard({ id: "dash-1", name: "Dashboard" });
    const update = server.mount(contract.experiments.updateExperimentDashboard, {
      body: ({ body }: SpyCall) => ({ ...savedDashboard, ...(body as DashboardFormValues) }),
      unblock: promise,
    });

    const { unmount } = render(
      <Harness initialWidgets={[chart]} save>
        <ChartSelection sourceWidgetId={chart.id} />
        <DashboardToolbar visible experimentId="exp-1" />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    try {
      await waitFor(() => expect(update.callCount).toBe(1));
      expect(update.body).toMatchObject({
        widgets: [chart, { type: "visualization", config: { visualizationId: copy.id } }],
      });

      await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
      await user.click(screen.getByRole("menuitem", { name: "editor.inspector.delete" }));
      expect(screen.getByLabelText("Chart IDs")).toHaveTextContent(/^source$/u);
      if (leaveDashboard) unmount();
      expect(update.callCount).toBe(1);
    } finally {
      act(() => resolve());
    }

    await waitFor(() => expect(update.callCount).toBe(2), { timeout: 3000 });
    expect(update.body).toMatchObject({ widgets: [chart] });
  });

  it("offers Open copy when the attachment fails after leaving the dashboard", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    const { promise, resolve } = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    server.mount(contract.experiments.createExperimentVisualization, { body: created });
    const attach = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 500,
      unblock: promise,
    });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const { unmount } = render(
      <Harness initialWidgets={[chart]} save>
        <ChartSelection sourceWidgetId={chart.id} />
        <DashboardToolbar visible experimentId="exp-1" />
      </Harness>,
    );

    try {
      await user.click(screen.getByRole("button", { name: "select chart" }));
      await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
      await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
      await waitFor(() => expect(attach.callCount).toBe(1));
      expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy");
      unmount();
    } finally {
      act(() => resolve());
    }

    await waitFor(() => expectOpenCopyLink(created.id), { timeout: 2000 });
    expect(attach.callCount).toBe(1);
  });

  it("waits for the queued dashboard save before offering copy recovery after leaving", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    const firstSave = Promise.withResolvers<void>();
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    server.mount(contract.experiments.createExperimentVisualization, { body: created });
    const attach = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 500,
      unblock: firstSave.promise,
    });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const queryClient = createTestQueryClient();
    const { unmount } = render(
      <Harness initialWidgets={[chart]} save>
        <ChartSelection sourceWidgetId={chart.id} />
        <RenameDashboard />
        <DashboardToolbar visible experimentId="exp-1" />
      </Harness>,
      { queryClient },
    );

    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() => expect(attach.callCount).toBe(1));

    const savedDashboard = createExperimentDashboard({ id: "dash-1" });
    const queuedSave = server.mount(contract.experiments.updateExperimentDashboard, {
      body: ({ body }: SpyCall) => ({ ...savedDashboard, ...(body as DashboardFormValues) }),
    });
    try {
      await user.click(screen.getByRole("button", { name: "Rename dashboard" }));
      unmount();
      expect(queuedSave.callCount).toBe(0);
    } finally {
      act(() => firstSave.resolve());
    }

    await waitFor(() =>
      expect(
        queryClient.getMutationCache().findAll({
          mutationKey: orpc.experiments.updateExperimentDashboard.key(),
          status: "success",
        }),
      ).toHaveLength(1),
    );
    expect(queuedSave.body).toMatchObject({
      name: "Renamed",
      widgets: [chart, { type: "visualization", config: { visualizationId: created.id } }],
    });
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "editor.inspector.copyNotAttached" }),
    );
  });

  it.each(["attach a chart copy", "remove a widget"])(
    "persists the latest widget list when an older PATCH is held and you %s",
    async (edit) => {
      const user = userEvent.setup();
      const original = createVisualization({ id: "source" });
      const created = createVisualization({ id: "copy" });
      const chart = createVisualizationWidget({
        config: { visualizationId: original.id, showTitle: true, showDescription: false },
      });
      const attaching = edit === "attach a chart copy";
      const initialWidgets = attaching ? [chart] : [chart, first];
      let storedDashboard = createExperimentDashboard({ id: "dash-1", widgets: initialWidgets });
      const writes: ExperimentDashboardWidget[][] = [];
      const persist = ({ body }: SpyCall) => {
        storedDashboard = { ...storedDashboard, ...(body as DashboardFormValues) };
        writes.push(storedDashboard.widgets);
        return storedDashboard;
      };

      const creation = Promise.withResolvers<void>();
      const firstSave = Promise.withResolvers<void>();
      server.mount(contract.experiments.getExperimentVisualization, { body: original });
      server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
      const create = server.mount(contract.experiments.createExperimentVisualization, {
        body: created,
        unblock: creation.promise,
      });
      const rename = server.mount(contract.experiments.updateExperimentDashboard, {
        body: persist,
        unblock: firstSave.promise,
      });
      function RemoveWidget() {
        const form = useFormContext<DashboardFormValues>();
        return <button onClick={() => form.setValue("widgets", [chart])}>Remove widget</button>;
      }
      render(
        <Harness initialWidgets={initialWidgets} save>
          <ChartSelection sourceWidgetId={chart.id} />
          <RenameDashboard />
          <RemoveWidget />
          <DashboardToolbar visible experimentId="exp-1" />
        </Harness>,
      );

      try {
        if (attaching) {
          await user.click(screen.getByRole("button", { name: "select chart" }));
          await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
          await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
          await waitFor(() => expect(create.callCount).toBe(1));
        }
        await user.click(screen.getByRole("button", { name: "Rename dashboard" }));
        await waitFor(() => expect(rename.callCount).toBe(1));
        expect(rename.body).toMatchObject({ name: "Renamed", widgets: initialWidgets });

        server.mount(contract.experiments.updateExperimentDashboard, { body: persist });
        if (attaching) {
          act(() => creation.resolve());
          await waitFor(() =>
            expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy"),
          );
        } else {
          await user.click(screen.getByRole("button", { name: "Remove widget" }));
        }
        // Let the debounce expire while the rename is still blocked.
        await act(() => new Promise((resolve) => setTimeout(resolve, 1200)));
      } finally {
        creation.resolve();
        act(() => firstSave.resolve());
      }

      await waitFor(() => expect(writes).toHaveLength(2));
      if (attaching) {
        expect(storedDashboard.widgets).toMatchObject([
          chart,
          { type: "visualization", config: { visualizationId: created.id } },
        ]);
      } else {
        expect(storedDashboard.widgets).toEqual([chart]);
      }
      expect(writes[0]).toEqual(initialWidgets);
    },
  );

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

    expectOpenCopyLink(created.id);
  });

  it("offers Open copy without inserting a widget when edit access is revoked during create", async () => {
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
    function dashboard(canEdit: boolean) {
      return (
        <Harness initialWidgets={[chart]} save canEdit={canEdit}>
          <ChartSelection sourceWidgetId={chart.id} />
          <DashboardToolbar visible experimentId="exp-1" />
        </Harness>
      );
    }

    const { rerender } = render(dashboard(true));
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
    await waitFor(() => expect(create.callCount).toBe(1));

    rerender(dashboard(false));
    act(() => resolve());
    await waitFor(() => expectOpenCopyLink(created.id));
    expect(screen.getByLabelText("Chart IDs")).toHaveTextContent(/^source$/u);
    expect(screen.getByLabelText("Selected widget")).toHaveTextContent(chart.id);
    expect(update.callCount).toBe(0);
    expect(create.callCount).toBe(1);
  });

  it("drops an unsaved copy after access is revoked and allows Duplicate again when access returns", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const created = createVisualization({ id: "copy" });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, {
      body: created,
    });
    const update = server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });
    const dismiss = vi.fn();
    vi.mocked(toast).mockReturnValue({ id: "copy-error", dismiss, update: vi.fn() });
    const chart = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    function dashboard(canEdit: boolean) {
      return (
        <Harness initialWidgets={[chart]} save canEdit={canEdit}>
          <ChartSelection sourceWidgetId={chart.id} />
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

    expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy");
    rerender(dashboard(false));
    expect(dismiss).toHaveBeenCalled();
    await waitFor(() => expectOpenCopyLink(created.id));
    expect(screen.getByLabelText("Chart IDs")).toHaveTextContent(/^source$/u);
    expect(screen.getByLabelText("Selected widget")).toHaveTextContent("none");
    await user.click(screen.getByRole("button", { name: "select chart" }));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    expect(screen.getByRole("menuitem", { name: "editor.inspector.delete" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "editor.inspector.retryCopySave" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    rerender(dashboard(true));
    await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
    expect(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" })).toBeEnabled();
    expect(
      screen.queryByRole("menuitem", { name: "editor.inspector.retryCopySave" }),
    ).not.toBeInTheDocument();
    expect(update.callCount).toBe(1);
    expect(create.callCount).toBe(1);
  });
  it.each([
    { status: 200, reason: "edit access is revoked", archived: false },
    { status: 500, reason: "edit access is revoked", archived: false },
    { status: 403, reason: "the experiment is archived", archived: true },
  ])(
    "reconciles an attachment PATCH that returns $status after $reason",
    async ({ status, archived }) => {
      const user = userEvent.setup();
      const original = createVisualization({ id: "source" });
      const created = createVisualization({ id: "copy" });
      const { promise, resolve } = Promise.withResolvers<void>();
      server.mount(contract.experiments.getExperimentVisualization, { body: original });
      server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
      const create = server.mount(contract.experiments.createExperimentVisualization, {
        body: created,
      });
      const savedDashboard = createExperimentDashboard({ id: "dash-1", name: "Dashboard" });
      const attaching = server.mount(contract.experiments.updateExperimentDashboard, {
        status,
        body: ({ body }: SpyCall) => ({ ...savedDashboard, ...(body as DashboardFormValues) }),
        unblock: promise,
      });
      const chart = createVisualizationWidget({
        config: { visualizationId: original.id, showTitle: true, showDescription: false },
      });
      function dashboard(canEdit: boolean) {
        return (
          <Harness initialWidgets={[chart]} save canEdit={canEdit}>
            <ChartSelection sourceWidgetId={chart.id} />
            <RenameDashboard />
            <DashboardToolbar visible experimentId="exp-1" />
          </Harness>
        );
      }

      const queryClient = createTestQueryClient();
      if (archived) {
        queryClient.setQueryData(
          experimentAccessQueryKey(dashboardSession.user.id, "exp-1"),
          createExperimentAccess({ experiment: { id: "exp-1", status: "active" }, isAdmin: true }),
        );
      }
      const { rerender } = render(dashboard(true), { queryClient });
      await user.click(screen.getByRole("button", { name: "select chart" }));
      await user.click(screen.getByRole("button", { name: "editor.inspector.more" }));
      await user.click(screen.getByRole("menuitem", { name: "editor.inspector.duplicate" }));
      await waitFor(() => expect(attaching.callCount).toBe(1));
      expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy");

      if (archived) {
        server.mount(contract.experiments.getExperimentAccess, {
          body: createExperimentAccess({ experiment: { id: "exp-1", status: "archived" } }),
        });
      }
      rerender(dashboard(false));
      expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy");
      act(() => resolve());
      if (status !== 200) {
        await waitFor(
          () => expectOpenCopyLink(created.id, archived ? "experiments-archive" : "experiments"),
          { timeout: 1500 },
        );
        expect(screen.getByLabelText("Chart IDs")).toHaveTextContent(/^source$/u);
      } else {
        await waitFor(() =>
          expect(
            queryClient.getMutationCache().find({
              mutationKey: orpc.experiments.updateExperimentDashboard.key(),
              exact: false,
            })?.state.status,
          ).toBe("success"),
        );
        expect(screen.getByLabelText("Chart IDs")).toHaveTextContent("source, copy");
        expect(toast).not.toHaveBeenCalledWith(
          expect.objectContaining({
            title: "editor.inspector.copyNotAttached",
          }),
        );
      }
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      expect(attaching.callCount).toBe(1);
      expect(create.callCount).toBe(1);
      if (archived) return;

      const nextSave = server.mount(contract.experiments.updateExperimentDashboard, {
        body: savedDashboard,
      });
      rerender(dashboard(true));
      await user.click(screen.getByRole("button", { name: "Rename dashboard" }));
      await waitFor(() => expect(nextSave.callCount).toBe(1));
      expect(nextSave.body).toMatchObject({ name: "Renamed" });
      if (status === 200) {
        expect(nextSave.body).toMatchObject({
          widgets: [chart, { type: "visualization", config: { visualizationId: created.id } }],
        });
      } else {
        expect(nextSave.body).toMatchObject({ widgets: [chart] });
      }
    },
  );
});
