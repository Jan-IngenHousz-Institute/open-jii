import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DashboardRowActions } from "./dashboard-row-actions";

describe("DashboardRowActions", () => {
  it("links Edit to the dashboard's page in edit mode", async () => {
    const user = userEvent.setup();
    render(
      <DashboardRowActions
        dashboard={createExperimentDashboard({ id: "dash-9" })}
        experimentId="exp-1"
        href="/platform/experiments-archive/exp-1/dashboards/dash-9"
      />,
    );

    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    expect(await screen.findByRole("menuitem", { name: /ui\.actions\.edit/u })).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/dashboards/dash-9?edit=1",
    );
  });

  it("asks before deleting, then fires the DELETE on confirm", async () => {
    const user = userEvent.setup();
    const deleteSpy = server.mount(contract.experiments.deleteExperimentDashboard, { status: 204 });
    render(
      <DashboardRowActions
        dashboard={createExperimentDashboard({ id: "dash-del" })}
        experimentId="exp-1"
        href="/platform/experiments/exp-1/dashboards/dash-del"
      />,
    );

    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    await user.click(await screen.findByRole("menuitem", { name: /ui\.actions\.delete/u }));
    expect(await screen.findByText("ui.messages.deleteConfirm")).toBeInTheDocument();

    const confirmButtons = screen.getAllByText("ui.actions.delete");
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(deleteSpy.called).toBe(true));
    expect(deleteSpy.params).toMatchObject({ id: "exp-1", dashboardId: "dash-del" });
  });
});
