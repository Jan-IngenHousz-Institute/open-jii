import {
  experimentDashboardQuery,
  useExperimentDashboard,
} from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import {
  createExperimentAccess,
  createExperimentDashboard,
  createRichTextWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import {
  act,
  assertExists,
  createTestQueryClient,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { zUpdateExperimentDashboardBody } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { DashboardFormShell } from "./dashboard-form-shell";
import type { DashboardFormValues } from "./dashboard-form-shell";
import { useDashboardMode } from "./dashboard-mode-context";
import { useDashboardCopySave } from "./editor/context/dashboard-copy-save-context";
import { useDashboardEditor } from "./editor/context/dashboard-editor-context";

// Replace the heavy layout body with a probe that pulls form state out of
// context. This isolates form-shell's responsibility: setting defaults and
// wiring providers.
vi.mock("./dashboard-layout-content", () => ({
  DashboardLayoutContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">
      <FormProbe />
      {children}
    </div>
  ),
}));

function FormProbe() {
  const form = useFormContext<DashboardFormValues>();
  const values = useWatch({ control: form.control });
  const { mode } = useDashboardMode();
  return (
    <div>
      <span data-testid="probe-name">{values.name}</span>
      <span data-testid="probe-desc">{values.description ?? ""}</span>
      <span data-testid="probe-widgets">{values.widgets?.length}</span>
      <span data-testid="probe-mode">{mode}</span>
    </div>
  );
}

describe("DashboardFormShell", () => {
  it.each(["stale", "published"] as const)(
    "enables chart duplication for a %s experiment admin",
    async (status) => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { id: "exp-1", status }, isAdmin: true }),
      });
      const dashboard = createExperimentDashboard();
      function CopyAvailability() {
        const recovery = useDashboardCopySave();
        return <button disabled={!recovery?.enabled}>Duplicate</button>;
      }
      render(
        <DashboardFormShell
          experimentId="exp-1"
          dashboardId={dashboard.id}
          dashboard={dashboard}
          initialMode="edit"
        >
          <CopyAvailability />
        </DashboardFormShell>,
      );
      await waitFor(() => expect(screen.getByRole("button", { name: "Duplicate" })).toBeEnabled());
    },
  );

  it("refreshes access after a forbidden copy save and links to the archived chart", async () => {
    const user = userEvent.setup();
    const original = createVisualization({ id: "source" });
    const copy = createVisualization({ id: "copy" });
    const widget = createVisualizationWidget({
      config: { visualizationId: original.id, showTitle: true, showDescription: false },
    });
    const dashboard = createExperimentDashboard({ widgets: [widget] });
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: "exp-1", status: "active" },
        isAdmin: true,
      }),
    });
    server.mount(contract.experiments.getExperimentVisualization, { body: original });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
    const create = server.mount(contract.experiments.createExperimentVisualization, { body: copy });
    const attachment = Promise.withResolvers<void>();
    const patch = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 403,
      body: { defined: false, code: "FORBIDDEN", status: 403, message: "Experiment is archived" },
      unblock: attachment.promise,
    });

    function CopyActions() {
      const { selectWidget } = useDashboardEditor();
      const recovery = useDashboardCopySave();
      return (
        <>
          <button onClick={() => selectWidget(widget.id)}>Select chart</button>
          <button
            disabled={!recovery?.enabled || recovery.duplicateDisabled}
            onClick={() => void recovery?.duplicateSelectedChart()}
          >
            Duplicate
          </button>
          {recovery?.retryAvailable && <button onClick={recovery.retry}>Retry saving copy</button>}
        </>
      );
    }

    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="edit"
      >
        <CopyActions />
      </DashboardFormShell>,
    );
    const duplicate = screen.getByRole("button", { name: "Duplicate" });
    await user.click(screen.getByRole("button", { name: "Select chart" }));
    await waitFor(() => expect(duplicate).toBeEnabled());
    await user.click(duplicate);
    await waitFor(() => expect(patch.callCount).toBe(1));
    expect(create.callCount).toBe(1);

    const refresh = Promise.withResolvers<void>();
    const archivedAccess = server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: "exp-1", status: "archived" },
        isAdmin: true,
      }),
      unblock: refresh.promise,
    });
    vi.mocked(toast).mockReturnValueOnce({ id: "copy-error", dismiss: vi.fn(), update: vi.fn() });
    const retryToast = { title: "editor.inspector.copySaveFailed" };
    act(() => attachment.resolve());
    try {
      await waitFor(() => expect(archivedAccess.called).toBe(true), { timeout: 1500 });
      expect(screen.queryByRole("button", { name: "Retry saving copy" })).toBeNull();
      expect(toast).not.toHaveBeenCalledWith(expect.objectContaining(retryToast));
    } finally {
      act(() => refresh.resolve());
    }

    await waitFor(() => {
      const action = vi
        .mocked(toast)
        .mock.calls.find(
          ([value]) => value.title === "editor.inspector.copyNotAttached",
        )?.[0].action;
      assertExists(action);
      expect(action.props).toMatchObject({
        children: {
          props: { href: "/en-US/platform/experiments-archive/exp-1/analysis/visualizations/copy" },
        },
      });
    });
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("view");
    expect(screen.queryByRole("button", { name: "Retry saving copy" })).toBeNull();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining(retryToast));
    expect(patch.callCount).toBe(1);
  });

  it("populates the form with the dashboard's name as the default", () => {
    const dashboard = createExperimentDashboard({ name: "Daily" });
    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="view"
      >
        <div data-testid="child" />
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("probe-name")).toHaveTextContent("Daily");
  });

  it("normalizes a null description to an empty string default", () => {
    const dashboard = createExperimentDashboard({ description: null });
    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="view"
      >
        <div />
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("probe-desc")).toHaveTextContent("");
  });

  it("preserves widgets from the source dashboard in the form defaults", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget(), createRichTextWidget()],
    });
    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="view"
      >
        <div />
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("probe-widgets")).toHaveTextContent("2");
  });

  it("propagates the initial edit mode after experiment access is granted", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: "exp-1", status: "active" },
        isAdmin: true,
      }),
    });
    const dashboard = createExperimentDashboard();
    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="edit"
      >
        <div />
      </DashboardFormShell>,
    );
    await waitFor(() => expect(screen.getByTestId("probe-mode")).toHaveTextContent("edit"));
  });

  it("renders children inside the layout body", () => {
    const dashboard = createExperimentDashboard();
    render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={dashboard.id}
        dashboard={dashboard}
        initialMode="view"
      >
        <span data-testid="child">canvas</span>
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

function setupDashboardReopen() {
  const user = userEvent.setup();
  const experimentId = crypto.randomUUID();
  const original = createVisualization({ id: crypto.randomUUID(), experimentId });
  const copy = createVisualization({ id: crypto.randomUUID(), experimentId });
  const source = createVisualizationWidget({
    config: { visualizationId: original.id, showTitle: true, showDescription: false },
  });
  const notes = createRichTextWidget({ layout: { col: 0, row: 4, colSpan: 6, rowSpan: 2 } });
  const dashboard = createExperimentDashboard({ experimentId, widgets: [source, notes] });
  let stored = dashboard;

  server.mount(contract.experiments.getExperimentDashboard, { body: () => stored });
  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({
      experiment: { id: experimentId, status: "active" },
      isAdmin: true,
    }),
  });
  server.mount(contract.experiments.getExperimentVisualization, { body: original });
  server.mount(contract.experiments.listExperimentVisualizations, { body: [original] });
  server.mount(contract.experiments.createExperimentVisualization, { body: copy });

  function persist(call: SpyCall) {
    const { name = stored.name, widgets = stored.widgets } = zUpdateExperimentDashboardBody.parse(
      call.body,
    );
    stored = { ...stored, name, widgets };
    return stored;
  }

  function EditActions() {
    const form = useFormContext<DashboardFormValues>();
    const { selectWidget } = useDashboardEditor();
    const recovery = useDashboardCopySave();
    return (
      <>
        <input aria-label="Dashboard name" {...form.register("name")} />
        <button onClick={() => selectWidget(source.id)}>Select chart</button>
        <button
          disabled={!recovery?.enabled || recovery.duplicateDisabled}
          onClick={() => void recovery?.duplicateSelectedChart()}
        >
          Duplicate
        </button>
        <button
          disabled={!recovery?.enabled}
          onClick={() => {
            form.setValue(
              "widgets",
              form.getValues("widgets").filter(({ id }) => id !== notes.id),
            );
          }}
        >
          Delete notes
        </button>
      </>
    );
  }

  function DashboardRoute() {
    const { data, isLoading, error } = useExperimentDashboard(dashboard.id, experimentId);
    return (
      <DashboardFormShell
        experimentId={experimentId}
        dashboardId={dashboard.id}
        dashboard={data}
        isLoading={isLoading}
        error={error}
        initialMode="edit"
      >
        <EditActions />
      </DashboardFormShell>
    );
  }

  const queryClient = createTestQueryClient();
  const { rerender } = render(<DashboardRoute />, { queryClient });
  function replace({ warm = true } = {}) {
    const incomingCache = createTestQueryClient();
    if (warm) {
      incomingCache.setQueryData(
        experimentDashboardQuery(dashboard.id, experimentId).queryKey,
        stored,
      );
    }
    rerender(
      <QueryClientProvider key="new-locale" client={incomingCache}>
        <DashboardRoute />
      </QueryClientProvider>,
    );
  }
  async function duplicateChart() {
    await user.click(screen.getByRole("button", { name: "Select chart" }));
    const duplicate = screen.getByRole("button", { name: "Duplicate" });
    await waitFor(() => expect(duplicate).toBeEnabled());
    await user.click(duplicate);
  }

  return {
    copy,
    queryClient,
    notes,
    source,
    experimentId,
    persist,
    replace,
    leave: () => rerender(<></>),
    reopen: () => rerender(<DashboardRoute />),
    getStored: () => stored,
    duplicateChart,
    deleteNotes: async () => {
      const remove = screen.getByRole("button", { name: "Delete notes" });
      await waitFor(() => expect(remove).toBeEnabled());
      await user.click(remove);
    },
  };
}

describe("DashboardFormShell reopen while saving", () => {
  const editActions = [
    { action: "Duplicate", count: 3, run: "duplicateChart" },
    { action: "Delete notes", count: 1, run: "deleteNotes" },
  ] as const;
  it.each(
    (["separate commits", "one commit"] as const).flatMap((transition) =>
      editActions.map((edit) => ({ ...edit, transition })),
    ),
  )(
    "preserves edits made after reopening the dashboard in $transition ($action)",
    async ({ action, count, run, transition }) => {
      const editor = setupDashboardReopen();
      const closeSave = Promise.withResolvers<void>();
      const closeSaved = Promise.withResolvers<void>();
      const oldPatch = server.mount(contract.experiments.updateExperimentDashboard, {
        unblock: closeSave.promise,
        body: (call: SpyCall) => {
          const saved = editor.persist(call);
          closeSaved.resolve();
          return saved;
        },
      });

      try {
        await waitFor(() => expect(screen.getByTestId("probe-mode")).toHaveTextContent("edit"));
        fireEvent.change(screen.getByRole("textbox", { name: "Dashboard name" }), {
          target: { value: "Renamed on close" },
        });
        if (transition === "one commit") editor.replace();
        else editor.leave();
        await waitFor(() => expect(oldPatch.callCount).toBe(1), { timeout: 1200 });
        expect(oldPatch.body).toMatchObject({
          name: "Renamed on close",
          widgets: [
            expect.objectContaining({ id: editor.source.id }),
            expect.objectContaining({ id: editor.notes.id }),
          ],
        });

        const newPatch = server.mount(contract.experiments.updateExperimentDashboard, {
          body: editor.persist,
        });
        if (transition === "separate commits") editor.reopen();

        // If the form opens early, let the new edit reach the server ahead of the old PATCH.
        const reopened = await screen.findByText(/^(common.loading|edit)$/);
        const openedEarly = reopened.textContent === "edit";
        if (openedEarly) {
          await editor[run]();
          await waitFor(() => expect(editor.getStored().widgets).toHaveLength(count), {
            timeout: 2000,
          });
        } else {
          expect(screen.queryByRole("button", { name: action })).toBeNull();
          expect(screen.queryByRole("textbox", { name: "Dashboard name" })).toBeNull();
        }

        await act(async () => {
          closeSave.resolve();
          await closeSaved.promise;
        });
        if (!openedEarly) {
          expect(await screen.findByRole("textbox", { name: "Dashboard name" })).toHaveValue(
            "Renamed on close",
          );
          await editor[run]();
        }

        await waitFor(() => expect(editor.getStored().widgets).toHaveLength(count), {
          timeout: 2000,
        });
        expect(newPatch.callCount).toBe(1);
        expect(editor.getStored().name).toBe("Renamed on close");
        if (run === "duplicateChart") {
          const chartIds = editor
            .getStored()
            .widgets.filter((widget) => widget.type === "visualization")
            .map((widget) => widget.config.visualizationId);
          expect(chartIds).toContain(editor.copy.id);
        } else {
          expect(editor.getStored().widgets[0]?.id).toBe(editor.source.id);
        }
      } finally {
        closeSave.resolve();
      }
    },
  );

  it.each([true, false])(
    "offers the copy during an offline save and waits for a reload (warm cache %s)",
    async (warm) => {
      const editor = setupDashboardReopen();
      const patch = server.mount(contract.experiments.updateExperimentDashboard, {
        body: editor.persist,
      });
      const reload = Promise.withResolvers<void>();

      try {
        await screen.findByRole("textbox", { name: "Dashboard name" });
        await editor.duplicateChart();
        await waitFor(() => expect(screen.getByTestId("probe-widgets")).toHaveTextContent("3"));

        vi.useFakeTimers();
        act(() => {
          onlineManager.setOnline(false);
          editor.replace({ warm });
        });
        expect(
          editor.queryClient
            .getMutationCache()
            .getAll()
            .some(({ state }) => state.isPaused),
        ).toBe(true);
        expect(screen.getByText("common.loading")).toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(screen.getByRole("status")).toHaveTextContent("ui.messages.saveStillInProgress");
        expect(
          screen.getByRole("link", { name: "editor.inspector.openChartCopy" }),
        ).toHaveAttribute(
          "href",
          `/en-US/platform/experiments/${editor.experimentId}/analysis/visualizations/${editor.copy.id}`,
        );
        expect(screen.queryByRole("textbox", { name: "Dashboard name" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();
        expect(patch.callCount).toBe(0);
        vi.useRealTimers();

        const detail = server.mount(contract.experiments.getExperimentDashboard, {
          body: editor.getStored,
          unblock: reload.promise,
        });
        act(() => onlineManager.setOnline(true));
        await waitFor(() => {
          expect(editor.getStored().widgets).toHaveLength(3);
          expect(detail.called).toBe(true);
        });
        expect(screen.queryByRole("textbox", { name: "Dashboard name" })).toBeNull();

        act(() => reload.resolve());
        expect(await screen.findByTestId("probe-widgets")).toHaveTextContent("3");
        expect(screen.queryByRole("status")).toBeNull();
        expect(patch.callCount).toBe(1);
      } finally {
        vi.useRealTimers();
        onlineManager.setOnline(true);
        reload.resolve();
      }
    },
  );

  it("offers the chart copy after its save fails on close and the dashboard reopens", async () => {
    const editor = setupDashboardReopen();
    const closeSave = Promise.withResolvers<void>();
    const oldPatch = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 500,
      body: { defined: false, code: "INTERNAL_SERVER_ERROR", status: 500, message: "Save failed" },
      unblock: closeSave.promise,
    });

    try {
      await screen.findByRole("textbox", { name: "Dashboard name" });
      await editor.duplicateChart();
      await waitFor(() => expect(screen.getByTestId("probe-widgets")).toHaveTextContent("3"));
      editor.leave();
      await waitFor(() => expect(oldPatch.callCount).toBe(1), { timeout: 1200 });
      editor.reopen();
      await screen.findByText("common.loading", {}, { timeout: 1000 });
      expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();

      act(() => closeSave.resolve());
      await waitFor(() => {
        const action = vi
          .mocked(toast)
          .mock.calls.find(
            ([value]) => value.title === "editor.inspector.copyNotAttached",
          )?.[0].action;
        assertExists(action);
        expect(action.props).toMatchObject({
          children: {
            props: {
              href: `/en-US/platform/experiments/${editor.experimentId}/analysis/visualizations/${editor.copy.id}`,
            },
          },
        });
      });
      expect(await screen.findByTestId("probe-widgets")).toHaveTextContent("2");
      expect(oldPatch.callCount).toBe(1);
    } finally {
      closeSave.resolve();
    }
  });
});
