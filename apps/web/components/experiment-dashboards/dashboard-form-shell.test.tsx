import {
  createExperimentAccess,
  createExperimentDashboard,
  createRichTextWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useFormContext } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { DashboardFormShell } from "./dashboard-form-shell";
import type { DashboardFormValues } from "./dashboard-form-shell";
import { useDashboardMode } from "./dashboard-mode-context";
import { useDashboardCopySave } from "./editor/context/dashboard-copy-save-context";

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
