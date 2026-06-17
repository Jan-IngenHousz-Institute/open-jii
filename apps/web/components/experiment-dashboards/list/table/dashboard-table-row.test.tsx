import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { Table, TableBody } from "@repo/ui/components/table";

import { DashboardTableRow } from "./dashboard-table-row";

function renderRow(props: Partial<Parameters<typeof DashboardTableRow>[0]> = {}) {
  const dashboard = props.dashboard ?? createExperimentDashboard();
  return render(
    <Table>
      <TableBody>
        <DashboardTableRow
          dashboard={dashboard}
          experimentId={props.experimentId ?? "exp-1"}
          basePath={props.basePath ?? "experiments"}
        />
      </TableBody>
    </Table>,
  );
}

describe("DashboardTableRow", () => {
  it("links the name cell to the dashboard view page", () => {
    const dashboard = createExperimentDashboard({ id: "dash-1", name: "Photosynth" });
    renderRow({ dashboard });

    const link = screen.getByRole("link", { name: "Photosynth" });
    expect(link).toHaveAttribute("href", "/platform/experiments/exp-1/dashboards/dash-1");
  });

  it("renders the widget count for the dashboard", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget(), createRichTextWidget(), createRichTextWidget()],
    });
    renderRow({ dashboard });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the formatted updatedAt date", () => {
    const updatedAt = "2024-03-10T00:00:00.000Z";
    const dashboard = createExperimentDashboard({ updatedAt });
    renderRow({ dashboard });
    expect(screen.getByText(formatDate(updatedAt))).toBeInTheDocument();
  });

  it("shows the creator name when present", () => {
    const dashboard = createExperimentDashboard({ createdByName: "Jane Doe" });
    renderRow({ dashboard });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("falls back to a truncated user id when createdByName is missing", () => {
    const dashboard = createExperimentDashboard({
      createdBy: "abcd1234-ef56-7890-abcd-ef1234567890",
      createdByName: undefined,
    });
    renderRow({ dashboard });
    expect(screen.getByText("abcd1234…")).toBeInTheDocument();
  });

  it("uses the supplied basePath when building the edit link", async () => {
    const dashboard = createExperimentDashboard({ id: "dash-9", name: "Archived" });
    renderRow({ dashboard, basePath: "experiments-archive" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "ui.actions.edit" }));
    const editLink = await screen.findByRole("menuitem", { name: /ui\.actions\.edit/ });
    expect(editLink).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/dashboards/dash-9?edit=1",
    );
  });

  it("opens the delete confirmation when delete is selected, and fires the DELETE on confirm", async () => {
    const dashboard = createExperimentDashboard({ id: "dash-del", name: "To delete" });
    const deleteSpy = server.mount(contract.experiments.deleteExperimentDashboard, { status: 204 });
    renderRow({ dashboard });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "ui.actions.edit" }));
    await user.click(await screen.findByRole("menuitem", { name: /ui\.actions\.delete/ }));

    expect(await screen.findByText("ui.messages.deleteConfirm")).toBeInTheDocument();

    const confirmButtons = screen.getAllByText("ui.actions.delete");
    // The dialog's confirm button is the last "delete" label rendered.
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(deleteSpy.called).toBe(true));
    expect(deleteSpy.params).toMatchObject({ id: "exp-1", dashboardId: "dash-del" });
  });
});
