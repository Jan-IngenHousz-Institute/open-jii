import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { assertExists, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { VisualizationRowActions } from "./visualization-row-actions";

function renderActions() {
  return render(
    <VisualizationRowActions
      visualization={createVisualization({ id: "viz-7", name: "My Plot" })}
      experimentId="exp-1"
      href="/platform/experiments/exp-1/analysis/visualizations/viz-7"
    />,
  );
}

describe("VisualizationRowActions", () => {
  it("links Edit to the chart's page", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    expect(await screen.findByRole("menuitem", { name: /ui\.actions\.edit/u })).toHaveAttribute(
      "href",
      "/platform/experiments/exp-1/analysis/visualizations/viz-7",
    );
  });

  it("asks before deleting, then calls the delete endpoint with the chart's id", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.experiments.deleteExperimentVisualization);
    renderActions();

    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    await user.click(await screen.findByText("ui.actions.delete"));
    const dialog = screen.getByRole("alertdialog", { name: "ui.actions.delete" });
    const confirm = within(dialog).getAllByText("ui.actions.delete").pop();
    assertExists(confirm);
    await user.click(confirm);

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.visualizationId).toBe("viz-7");
    });
  });
});
