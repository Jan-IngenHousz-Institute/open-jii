import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { DashboardFormShell } from "./dashboard-form-shell";
import type { DashboardFormValues } from "./dashboard-form-shell";
import { useDashboardMode } from "./dashboard-mode-context";

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

// Autosave attaches a `form.watch` subscriber; that's tested separately.
vi.mock("./editor/hooks/use-dashboard-autosave", () => ({
  useDashboardAutosave: vi.fn(),
}));

function FormProbe() {
  const form = useFormContext<DashboardFormValues>();
  const values = useWatch<DashboardFormValues>({ control: form.control });
  const { mode } = useDashboardMode();
  return (
    <div>
      <span data-testid="probe-name">{values.name ?? ""}</span>
      <span data-testid="probe-desc">{values.description ?? ""}</span>
      <span data-testid="probe-widgets">{values.widgets?.length ?? 0}</span>
      <span data-testid="probe-mode">{mode}</span>
    </div>
  );
}

describe("DashboardFormShell", () => {
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

  it("propagates the initialMode into the dashboard-mode provider", () => {
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
    expect(screen.getByTestId("probe-mode")).toHaveTextContent("edit");
  });

  it("resyncs form defaults when the dashboard prop changes while the form is idle", () => {
    const initial = createExperimentDashboard({ id: "d1", name: "Original" });
    const { rerender } = render(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={initial.id}
        dashboard={initial}
        initialMode="view"
      >
        <div />
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("probe-name")).toHaveTextContent("Original");

    // Simulate a server refetch returning an updated snapshot for the same
    // dashboard. The form should pick up the new name because no user edit
    // is in flight.
    const refreshed = { ...initial, name: "Refreshed" };
    rerender(
      <DashboardFormShell
        experimentId="exp-1"
        dashboardId={refreshed.id}
        dashboard={refreshed}
        initialMode="view"
      >
        <div />
      </DashboardFormShell>,
    );
    expect(screen.getByTestId("probe-name")).toHaveTextContent("Refreshed");
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
