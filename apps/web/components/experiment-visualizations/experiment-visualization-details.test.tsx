/**
 * ExperimentVisualizationDetails — tests with MSW.
 *
 * All four hooks (useExperimentAccess, useExperimentVisualization,
 * useExperimentVisualizationData, useExperimentVisualizationDelete)
 * run for real; MSW intercepts the HTTP requests made by the `tsr`
 * client and returns controlled responses.
 */
import {
  createExperimentAccess,
  createExperimentDataTable,
  createVisualization,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { ExperimentVisualization } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import ExperimentVisualizationDetails from "./experiment-visualization-details";

vi.mock("./experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: ExperimentVisualization }) => (
    <div data-testid="visualization-renderer">{visualization.name}</div>
  ),
}));

const vizId = "viz-123";
const expId = "exp-456";

const defaultViz = createVisualization({ id: vizId, experimentId: expId });
const defaultDataTable = createExperimentDataTable({ name: defaultViz.dataConfig.tableName });
const defaultColumns = defaultDataTable.data?.columns ?? [];

interface SetupOpts {
  access?: Parameters<typeof createExperimentAccess>[0];
  visualization?: Partial<ExperimentVisualization> | false;
  isArchiveContext?: boolean;
}

function setup(opts: SetupOpts = {}) {
  vi.mocked(notFound).mockClear();

  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({
      isAdmin: true,
      experiment: { id: expId },
      ...opts.access,
    }),
  });

  if (opts.visualization === false) {
    server.mount(contract.experiments.getExperimentVisualization, { status: 500 });
  } else {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: { ...defaultViz, ...opts.visualization },
    });
  }

  server.mount(contract.experiments.getExperimentData, {
    body: [defaultDataTable],
  });

  const user = userEvent.setup();
  const { router } = render(
    <ExperimentVisualizationDetails
      visualizationId={vizId}
      experimentId={expId}
      isArchiveContext={opts.isArchiveContext}
    />,
  );

  return { user, router };
}

describe("ExperimentVisualizationDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading then resolves with visualization details", async () => {
    setup();
    // Initially loading while waiting for data
    expect(screen.getByText("ui.messages.loading")).toBeInTheDocument();

    // Data arrives via MSW
    await waitFor(() => {
      expect(screen.getAllByText(defaultViz.name).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(defaultViz.description ?? "")).toBeInTheDocument();
    expect(screen.getByText(defaultViz.createdByName ?? "")).toBeInTheDocument();
    expect(screen.getByText(defaultDataTable.name)).toBeInTheDocument();
  });

  it("renders error state with back navigation", async () => {
    const { user, router } = setup({ visualization: false });

    await waitFor(() => {
      expect(screen.getByText("ui.messages.failedToLoad")).toBeInTheDocument();
    });
    await user.click(screen.getByText("ui.actions.back"));
    expect(router.push).toHaveBeenCalledWith(`/en-US/platform/experiments/${expId}`);
  });

  it("displays formatted dates", async () => {
    setup();
    await waitFor(() => {
      expect(
        screen.getByText(new Date(defaultViz.createdAt).toLocaleDateString()),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(new Date(defaultViz.updatedAt).toLocaleDateString()),
    ).toBeInTheDocument();
  });

  it("shows columns count", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText(`${defaultColumns.length} columns`)).toBeInTheDocument();
    });
  });

  it("renders visualization renderer", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    });
  });

  it("shows truncated ID when createdByName is missing", async () => {
    setup({ visualization: { createdByName: undefined } });
    await waitFor(() => {
      expect(screen.getByText(`${defaultViz.createdBy.substring(0, 8)}...`)).toBeInTheDocument();
    });
  });

  it("hides description when null", async () => {
    setup({ visualization: { description: null } });
    await waitFor(() => {
      expect(screen.getAllByText(defaultViz.name).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(defaultViz.description ?? "")).not.toBeInTheDocument();
  });

  it("navigates to edit page", async () => {
    const { user, router } = setup();
    await waitFor(() => {
      expect(screen.getByText("ui.actions.title")).toBeInTheDocument();
    });
    await user.click(screen.getByText("ui.actions.title"));
    await user.click(screen.getByText("ui.actions.edit"));
    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/experiments/${expId}/analysis/visualizations/${vizId}/edit`,
    );
  });

  it("calls delete via real mutation (MSW intercepts DELETE)", async () => {
    const deleteSpy = server.mount(contract.experiments.deleteExperimentVisualization);

    const { user, router } = setup();
    await waitFor(() => {
      expect(screen.getByText("ui.actions.title")).toBeInTheDocument();
    });
    await user.click(screen.getByText("ui.actions.title"));
    await user.click(screen.getByText("ui.actions.delete"));

    await waitFor(() => {
      expect(deleteSpy.params).toEqual({ id: expId, visualizationId: vizId });
    });

    // onSuccess fires toast + navigation
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ description: "ui.messages.deleteSuccess" });
    });
    expect(router.push).toHaveBeenCalledWith(`/en-US/platform/experiments/${expId}`);
  });

  it("shows column details on click", async () => {
    const columnsLabel = `${defaultColumns.length} columns`;

    const { user } = setup();
    await waitFor(() => {
      expect(screen.getByText(columnsLabel)).toBeInTheDocument();
    });
    await user.click(screen.getByText(columnsLabel));
    for (const col of defaultColumns) {
      expect(screen.getByText(col.name)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/^[xy]$/)).toHaveLength(defaultColumns.length);
  });

  describe("archived experiment", () => {
    const archiveAccess = {
      experiment: { status: "archived" as const },
      isAdmin: false,
    };

    it("calls notFound without archive context", async () => {
      setup({ access: archiveAccess });
      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("does NOT call notFound with archive context", async () => {
      setup({ access: archiveAccess, isArchiveContext: true });
      // Wait for data to arrive, then assert notFound was NOT called
      await waitFor(() => {
        expect(
          screen.queryByText("ui.messages.loading") ?? screen.queryByText(defaultViz.name),
        ).toBeTruthy();
      });
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("disables actions button for archived experiment", async () => {
      setup({ access: archiveAccess, isArchiveContext: true });
      await waitFor(() => {
        expect(screen.getByText("ui.actions.title")).toBeInTheDocument();
      });
      expect(screen.getByText("ui.actions.title")).toBeDisabled();
    });
  });
});
