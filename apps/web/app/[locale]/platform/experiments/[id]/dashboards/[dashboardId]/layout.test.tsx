import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound, useParams, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import DashboardLayout from "./layout";

// The form shell pulls in the full editor canvas tree (react-grid-layout,
// Plotly). Stub it for the layout test; the shell has its own coverage.
vi.mock("@/components/experiment-dashboards/dashboard-form-shell", () => ({
  DashboardFormShell: ({
    experimentId,
    dashboardId,
    initialMode,
    children,
  }: {
    experimentId: string;
    dashboardId: string;
    initialMode: "view" | "edit";
    children: ReactNode;
  }) => (
    <div
      data-testid="form-shell"
      data-experiment={experimentId}
      data-dashboard={dashboardId}
      data-mode={initialMode}
    >
      {children}
    </div>
  ),
}));

const dashboardId = "dash-1";
const experimentId = "exp-1";

function renderLayout(children: ReactNode = <div data-testid="child">child</div>) {
  return render(<DashboardLayout>{children}</DashboardLayout>);
}

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: experimentId, dashboardId });
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );
  });

  it("shows the loading state while the dashboard is in flight", () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: dashboardId }),
      delay: 999_999,
    });
    renderLayout();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("calls notFound when the dashboard fetch returns 404", async () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, { status: 404 });
    renderLayout();
    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders the form shell with the loaded dashboard and view mode by default", async () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: dashboardId, name: "Crop yield board" }),
    });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByTestId("form-shell")).toBeInTheDocument();
    });
    expect(screen.getByTestId("form-shell")).toHaveAttribute("data-experiment", experimentId);
    expect(screen.getByTestId("form-shell")).toHaveAttribute("data-dashboard", dashboardId);
    expect(screen.getByTestId("form-shell")).toHaveAttribute("data-mode", "view");
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("starts in edit mode when ?edit=1 is in the URL", async () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: dashboardId }),
    });
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("edit=1") as ReturnType<typeof useSearchParams>,
    );
    renderLayout();
    await waitFor(() => {
      expect(screen.getByTestId("form-shell")).toHaveAttribute("data-mode", "edit");
    });
  });

  it("falls back to view mode when ?edit is any other value", async () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: dashboardId }),
    });
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("edit=true") as ReturnType<typeof useSearchParams>,
    );
    renderLayout();
    await waitFor(() => {
      expect(screen.getByTestId("form-shell")).toHaveAttribute("data-mode", "view");
    });
  });

  it("renders an error display for non-404 errors", async () => {
    server.mount(orpcContract.experiments.getExperimentDashboard, { status: 500 });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("errors.error")).toBeInTheDocument();
    });
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });
});
