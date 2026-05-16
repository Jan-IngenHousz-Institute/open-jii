import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { LiveVizProvider } from "../context/live-viz-context";
import { EmbeddedVisualizationBuilder } from "./embedded-visualization-builder";

interface SetupOpts {
  renderWidgetTab?: (chartTypePicker: ReactNode) => ReactNode;
}

// Custom wrappers override the QueryClient that test-utils' render() supplies,
// so the LiveVizProvider sits inside the rendered tree instead.
function setupRender({ renderWidgetTab = () => <div>widget-tab-slot</div> }: SetupOpts = {}) {
  return render(
    <LiveVizProvider>
      <EmbeddedVisualizationBuilder
        experimentId="exp-1"
        visualizationId="viz-1"
        renderWidgetTab={renderWidgetTab}
      />
    </LiveVizProvider>,
  );
}

describe("EmbeddedVisualizationBuilder", () => {
  it("renders the loading state until the visualization resolves", async () => {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: createVisualization({ id: "viz-1" }),
      delay: 30,
    });
    // Post-resolution the BuilderBody fetches tables + data; pre-mount empties
    // so the MSW unhandled-request channel stays quiet.
    server.mount(contract.experiments.getExperimentTables, { body: [] });
    server.mount(contract.experiments.getExperimentData, { body: [] });
    setupRender();
    expect(screen.getByText("workspace.inspector.loadingTables")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("workspace.inspector.loadingTables")).not.toBeInTheDocument(),
    );
  });

  it("renders the error message when the visualization fails to load", async () => {
    server.mount(contract.experiments.getExperimentVisualization, { status: 500 });
    setupRender();
    await waitFor(() => expect(screen.getByText("errors.failedToLoadData")).toBeInTheDocument());
  });

  it("mounts the BuilderBody with the supplied renderWidgetTab once the viz resolves", async () => {
    // The factory's dataConfig.tableName ('test_table') triggers a data fetch
    // in the builder body; mount the full cascade so requests resolve quietly.
    server.mount(contract.experiments.getExperimentVisualization, {
      body: createVisualization({ id: "viz-1" }),
    });
    server.mount(contract.experiments.getExperimentTables, { body: [] });
    server.mount(contract.experiments.getExperimentData, { body: [] });

    setupRender({ renderWidgetTab: () => <div>my-custom-widget-tab</div> });
    await waitFor(() => expect(screen.getByText("my-custom-widget-tab")).toBeInTheDocument());
  });
});
