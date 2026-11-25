import { DashboardModeProvider } from "@/components/experiment-dashboards/dashboard-mode-context";
import { experimentAccessQueryKey } from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import { createExperimentAccess, createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, render, screen, waitFor } from "@/test/test-utils";
import { useParams, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DashboardPage from "./dashboard-detail-content";
import DashboardLayout from "./layout";

vi.mock("@/components/experiment-dashboards/dashboard-view-body", () => ({
  DashboardViewBody: ({
    experimentId,
    dashboardId,
  }: {
    experimentId: string;
    dashboardId: string;
  }) => <div data-testid="view-body" data-experiment={experimentId} data-dashboard={dashboardId} />,
}));

vi.mock("@/components/experiment-dashboards/editor/dashboard-editor-body", () => ({
  DashboardEditorBody: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="editor-body" data-experiment={experimentId} />
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: "exp-1", dashboardId: "dash-9" });
  });

  it("renders the view body by default", () => {
    render(
      <DashboardModeProvider>
        <DashboardPage />
      </DashboardModeProvider>,
    );
    const body = screen.getByTestId("view-body");
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute("data-experiment", "exp-1");
    expect(body).toHaveAttribute("data-dashboard", "dash-9");
    expect(screen.queryByTestId("editor-body")).not.toBeInTheDocument();
  });

  it("renders the editor body when initial mode is edit", () => {
    render(
      <DashboardModeProvider initialMode="edit">
        <DashboardPage />
      </DashboardModeProvider>,
    );
    const body = screen.getByTestId("editor-body");
    expect(body).toBeInTheDocument();
    expect(body).toHaveAttribute("data-experiment", "exp-1");
    expect(screen.queryByTestId("view-body")).not.toBeInTheDocument();
  });

  it("shows the read-only canvas and hides Edit for an archived experiment with ?edit=1", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("edit=1") as ReturnType<typeof useSearchParams>,
    );
    server.mount(contract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: "dash-9", name: "Archived dashboard" }),
    });
    const access = createExperimentAccess({
      experiment: { id: "exp-1", status: "archived" },
      isAdmin: true,
    });
    server.mount(contract.experiments.getExperimentAccess, { body: access });
    const queryClient = createTestQueryClient();
    render(
      <DashboardLayout>
        <DashboardPage />
      </DashboardLayout>,
      { queryClient },
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(experimentAccessQueryKey(undefined, "exp-1"))).toEqual(
        access,
      ),
    );
    expect(await screen.findByTestId("view-body")).toBeInTheDocument();
    expect(screen.queryByTestId("editor-body")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ui\.actions\.(edit|done)/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("form.descriptionPlaceholder")).not.toBeInTheDocument();
  });

  it("forwards both the experimentId and dashboardId to the view body", () => {
    vi.mocked(useParams).mockReturnValue({ id: "other-exp", dashboardId: "other-dash" });
    render(
      <DashboardModeProvider>
        <DashboardPage />
      </DashboardModeProvider>,
    );
    expect(screen.getByTestId("view-body")).toHaveAttribute("data-experiment", "other-exp");
    expect(screen.getByTestId("view-body")).toHaveAttribute("data-dashboard", "other-dash");
  });
});
