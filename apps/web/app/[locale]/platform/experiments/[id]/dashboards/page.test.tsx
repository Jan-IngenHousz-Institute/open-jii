import { createExperimentAccess, createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound, useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import ExperimentDashboardsPage from "./page";

const experimentId = "exp-123";

function mountAccess(isAdmin = true, status: "active" | "archived" = "active") {
  return server.mount(orpcContract.experiments.getExperimentAccess, {
    body: createExperimentAccess({
      isAdmin,
      experiment: { id: experimentId, status },
    }),
  });
}

describe("ExperimentDashboardsPage", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: experimentId });
  });

  it("renders the page title and subtitle", () => {
    mountAccess();
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });

    render(<ExperimentDashboardsPage />);

    expect(screen.getByText("ui.title")).toBeInTheDocument();
    expect(screen.getByText("ui.subtitle")).toBeInTheDocument();
  });

  it("lists dashboards returned by the API", async () => {
    const a = createExperimentDashboard({ experimentId, name: "Heatmap board" });
    const b = createExperimentDashboard({ experimentId, name: "Wellness board" });
    mountAccess();
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [a, b] });

    render(<ExperimentDashboardsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Heatmap board").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Wellness board").length).toBeGreaterThan(0);
  });

  it("disables the create button while access is loading", () => {
    server.mount(orpcContract.experiments.getExperimentAccess, {
      body: createExperimentAccess({ isAdmin: true }),
      delay: 999_999,
    });
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });

    render(<ExperimentDashboardsPage />);

    expect(screen.getByRole("button", { name: "ui.actions.create" })).toBeDisabled();
  });

  it("disables the create button when the caller is not an admin", async () => {
    mountAccess(false);
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });

    render(<ExperimentDashboardsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ui.actions.create" })).toBeDisabled();
    });
  });

  it("creates a dashboard and navigates to its edit view on click", async () => {
    const user = userEvent.setup();
    mountAccess();
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });
    const created = createExperimentDashboard({ id: "new-board", experimentId });
    const createSpy = server.mount(orpcContract.experiments.createExperimentDashboard, {
      status: 201,
      body: created,
    });

    const { router } = render(<ExperimentDashboardsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ui.actions.create" })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: "ui.actions.create" }));

    await waitFor(() => {
      expect(JSON.stringify(createSpy.body)).toMatch(/"name":"form\.namePlaceholder/);
    });
    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/experiments/${experimentId}/dashboards/new-board?edit=1`,
    );
  });

  it("calls notFound when the underlying experiment is archived", async () => {
    mountAccess(true, "archived");
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });

    render(<ExperimentDashboardsPage />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });
});
