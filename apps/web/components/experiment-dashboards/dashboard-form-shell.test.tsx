import {
  createExperimentAccess,
  createExperimentDashboard,
  createRichTextWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, assertExists, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useFormContext } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
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
  const values = form.getValues();
  const { mode } = useDashboardMode();
  return (
    <div>
      <span data-testid="probe-name">{values.name}</span>
      <span data-testid="probe-desc">{values.description ?? ""}</span>
      <span data-testid="probe-widgets">{values.widgets.length}</span>
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
