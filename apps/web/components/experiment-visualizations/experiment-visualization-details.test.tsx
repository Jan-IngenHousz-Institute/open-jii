/**
 * ExperimentVisualizationDetails — tests with MSW.
 *
 * All four hooks (useExperimentAccess, useExperimentVisualization,
 * useExperimentVisualizationData, useExperimentVisualizationDelete)
 * run for real; MSW intercepts the HTTP requests made by the `tsr`
 * client and returns controlled responses.
 */
import { createExperimentAccess, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { useRouter, notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { ExperimentVisualization } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import ExperimentVisualizationDetails from "./experiment-visualization-details";

/* ─── Mocks that are NOT HTTP ────────────────────────────────── */

vi.mock("./experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: ExperimentVisualization }) => (
    <div data-testid="visualization-renderer">{visualization.name}</div>
  ),
}));

/* ─── Fixtures ──────────────────────────────────────────────── */

const vizId = "viz-123";
const expId = "exp-456";

const vizPayload = createVisualization({
  id: vizId,
  name: "Test Visualization",
  description: "A test visualization",
  experimentId: expId,
  createdBy: "user-123",
  createdByName: "Test User",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
});

const accessPayload = (overrides: Record<string, unknown> = {}) =>
  createExperimentAccess({
    isAdmin: (overrides.isAdmin as boolean | undefined) ?? true,
    experiment: {
      id: expId,
      name: "Test",
      description: "",
      ...((overrides.experiment as Record<string, unknown> | undefined) ?? {}),
    },
  });

/* ─── Setup helper ──────────────────────────────────────────── */

interface SetupOpts {
  accessOverrides?: Record<string, unknown>;
  vizOverride?: Record<string, unknown> | null;
  vizError?: boolean;
  isArchiveContext?: boolean;
}

function setup(opts: SetupOpts = {}) {
  // Reset router mocks per test
  const router = vi.mocked(useRouter)();
  router.push.mockClear();
  router.back.mockClear();
  vi.mocked(notFound).mockClear();

  // Access handler
  server.mount(contract.experiments.getExperimentAccess, {
    body: accessPayload(opts.accessOverrides),
  });

  // Visualization handler
  if (opts.vizError) {
    server.mount(contract.experiments.getExperimentVisualization, { status: 500 });
  } else if (opts.vizOverride !== undefined) {
    if (opts.vizOverride === null) {
      server.mount(contract.experiments.getExperimentVisualization, { status: 500 });
    } else {
      server.mount(contract.experiments.getExperimentVisualization, {
        body: { ...vizPayload, ...opts.vizOverride },
      });
    }
  } else {
    server.mount(contract.experiments.getExperimentVisualization, { body: vizPayload });
  }

  // Data handler — always needed for the "test_table" assertion
  server.mount(contract.experiments.getExperimentData, {
    body: [
      {
        name: "test_table",
        catalog_name: "catalog",
        schema_name: "schema",
        totalRows: 2,
        data: {
          rows: [
            { time: 1, value: 10 },
            { time: 2, value: 20 },
          ],
        },
      },
    ],
  });

  const user = userEvent.setup();
  render(
    <ExperimentVisualizationDetails
      visualizationId={vizId}
      experimentId={expId}
      isArchiveContext={opts.isArchiveContext}
    />,
  );

  return { user, router: vi.mocked(useRouter)() };
}

/* ─── Tests ─────────────────────────────────────────────────── */

describe("ExperimentVisualizationDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  /* States */

  it("shows loading then resolves with visualization details", async () => {
    setup();
    // Initially loading while waiting for data
    expect(screen.getByText("ui.messages.loading")).toBeInTheDocument();

    // Data arrives via MSW
    await waitFor(() => {
      expect(screen.getAllByText("Test Visualization").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("A test visualization")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test_table")).toBeInTheDocument();
  });

  it("renders error state with back navigation", async () => {
    const { user, router } = setup({ vizError: true });

    await waitFor(() => {
      expect(screen.getByText("ui.messages.failedToLoad")).toBeInTheDocument();
    });
    await user.click(screen.getByText("ui.actions.back"));
    expect(router.push).toHaveBeenCalledWith(`/en-US/platform/experiments/${expId}`);
  });

  /* Successful rendering */

  it("displays formatted dates", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText(new Date("2024-01-01").toLocaleDateString())).toBeInTheDocument();
    });
    expect(screen.getByText(new Date("2024-01-15").toLocaleDateString())).toBeInTheDocument();
  });

  it("shows columns count", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("2 columns")).toBeInTheDocument();
    });
  });

  it("renders visualization renderer", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    });
  });

  it("shows truncated ID when createdByName is missing", async () => {
    setup({ vizOverride: { createdByName: undefined } });
    await waitFor(() => {
      expect(screen.getByText("user-123...")).toBeInTheDocument();
    });
  });

  it("hides description when null", async () => {
    setup({ vizOverride: { description: null } });
    await waitFor(() => {
      expect(screen.getAllByText("Test Visualization").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("A test visualization")).not.toBeInTheDocument();
  });

  /* Actions */

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

  /* Columns dropdown */

  it("shows column details on click", async () => {
    const { user } = setup();
    await waitFor(() => {
      expect(screen.getByText("2 columns")).toBeInTheDocument();
    });
    await user.click(screen.getByText("2 columns"));
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("value")).toBeInTheDocument();
    expect(screen.getAllByText(/^[xy]$/)).toHaveLength(2);
  });

  /* Archived experiment */

  describe("archived experiment", () => {
    const archiveAccess = {
      experiment: { status: "archived" },
      isAdmin: false,
    };

    it("calls notFound without archive context", async () => {
      setup({ accessOverrides: archiveAccess });
      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("does NOT call notFound with archive context", async () => {
      setup({ accessOverrides: archiveAccess, isArchiveContext: true });
      // Wait for data to arrive, then assert notFound was NOT called
      await waitFor(() => {
        expect(
          screen.queryByText("ui.messages.loading") ?? screen.queryByText("Test Visualization"),
        ).toBeTruthy();
      });
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("disables actions button for archived experiment", async () => {
      setup({ accessOverrides: archiveAccess, isArchiveContext: true });
      await waitFor(() => {
        expect(screen.getByText("ui.actions.title")).toBeInTheDocument();
      });
      expect(screen.getByText("ui.actions.title")).toBeDisabled();
    });
  });
});
