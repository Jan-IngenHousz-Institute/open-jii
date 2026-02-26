import {
  createExperimentAccess,
  createExperimentTable,
  createVisualization,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound, useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import EditVisualizationPage from "./page";

// --- Component mocks ---

vi.mock("@/components/experiment-visualizations/edit-visualization-form", () => ({
  default: ({
    experimentId,
    visualization,
    tables,
    onSuccess,
    isLoading,
    isPreviewOpen,
    onPreviewClose,
  }: {
    experimentId: string;
    visualization?: { id: string; name: string };
    tables: unknown[];
    onSuccess: (id: string) => void;
    isLoading: boolean;
    isPreviewOpen: boolean;
    onPreviewClose: () => void;
  }) => (
    <div data-testid="edit-visualization-form" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      {visualization && <div>Visualization: {visualization.name}</div>}
      <div>Tables: {tables.length}</div>
      <div>Preview Open: {isPreviewOpen ? "Yes" : "No"}</div>
      <button onClick={() => onSuccess("viz-456")}>Save Changes</button>
      <button onClick={onPreviewClose}>Close Preview</button>
    </div>
  ),
}));

// --- Helpers ---

const experimentId = "exp-123";
const visualizationId = "viz-456";

const defaultVisualization = () =>
  createVisualization({ id: visualizationId, name: "Test Chart", experimentId });

function mountDefaults(overrides?: {
  visualization?: ReturnType<typeof createVisualization>;
  tables?: ReturnType<typeof createExperimentTable>[];
}) {
  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({
      experiment: { id: experimentId, status: "active" },
    }),
  });
  server.mount(contract.experiments.getExperimentVisualization, {
    body: overrides?.visualization ?? defaultVisualization(),
  });
  server.mount(contract.experiments.getExperimentTables, {
    body: overrides?.tables ?? [],
  });
}

// --- Tests ---

describe("EditVisualizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({
      id: experimentId,
      visualizationId,
      locale: "en-US",
    });
  });

  describe("Loading state", () => {
    it("should show loading state when visualization is loading", () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
        delay: 999_999,
      });
      server.mount(contract.experiments.getExperimentTables, { body: [] });

      render(<EditVisualizationPage />);

      expect(screen.getByText("ui.actions.edit")).toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("should show loading state when sample data is loading", () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
        delay: 999_999,
      });
      server.mount(contract.experiments.getExperimentTables, {
        body: [],
        delay: 999_999,
      });

      render(<EditVisualizationPage />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("should show loading state when both are loading", () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
        delay: 999_999,
      });
      server.mount(contract.experiments.getExperimentTables, {
        body: [],
        delay: 999_999,
      });

      render(<EditVisualizationPage />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should call notFound when visualization has error", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentVisualization, { status: 500 });
      server.mount(contract.experiments.getExperimentTables, { body: [] });

      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("should call notFound when visualization is not found", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentVisualization, { status: 404 });
      server.mount(contract.experiments.getExperimentTables, { body: [] });

      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });
  });

  describe("Successful rendering", () => {
    it("should render page title", async () => {
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("ui.actions.edit")).toBeInTheDocument();
        expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
      });
    });

    it("should render preview button", async () => {
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });
    });

    it("should render form with correct data", async () => {
      mountDefaults({
        visualization: createVisualization({
          id: visualizationId,
          name: "Temperature Chart",
          experimentId,
        }),
        tables: [createExperimentTable()],
      });
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText(`Experiment: ${experimentId}`)).toBeInTheDocument();
        expect(screen.getByText("Visualization: Temperature Chart")).toBeInTheDocument();
        expect(screen.getByText("Tables: 1")).toBeInTheDocument();
      });
    });

    it("should pass sample tables to form", async () => {
      mountDefaults({
        tables: [createExperimentTable(), createExperimentTable(), createExperimentTable()],
      });
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Tables: 3")).toBeInTheDocument();
      });
    });
  });

  describe("Preview functionality", () => {
    it("should initially have preview closed", async () => {
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
      });
    });

    it("should open preview when button is clicked", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });

      const previewButton = screen.getByRole("button", { name: /preview.title/ });

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });
    });

    it("should close preview when onPreviewClose is called", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });

      // Open preview
      const previewButton = screen.getByRole("button", { name: /preview.title/ });

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });

      // Close preview
      const closeButton = screen.getByText("Close Preview");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("should navigate to visualization detail on success", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Save Changes"));

      const router = vi.mocked(useRouter)();
      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          `/en-US/platform/experiments/${experimentId}/analysis/visualizations/${visualizationId}`,
        );
      });
    });

    it("should construct correct URL path", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Save Changes"));

      const router = vi.mocked(useRouter)();
      await waitFor(() => {
        expect(router.push).toHaveBeenCalled();
        const calledPath = vi.mocked(router.push).mock.calls[0]?.[0] as string;
        expect(calledPath).toContain(experimentId);
        expect(calledPath).toContain("analysis/visualizations");
        expect(calledPath).toContain(visualizationId);
      });
    });
  });

  describe("Hook integration", () => {
    it("should request visualization with correct params", async () => {
      const spy = server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
      });
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      server.mount(contract.experiments.getExperimentTables, { body: [] });

      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(spy.called).toBe(true);
      });
    });

    it("should request tables with correct params", async () => {
      server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
      });
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { status: "active" } }),
      });
      const spy = server.mount(contract.experiments.getExperimentTables, { body: [] });

      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(spy.called).toBe(true);
      });
    });
  });

  describe("Button styling", () => {
    it("should render preview button", async () => {
      mountDefaults();
      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });
    });
  });

  describe("Archived experiment handling", () => {
    it("should call notFound when experiment is archived", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({
          experiment: { id: experimentId, status: "archived" },
        }),
      });
      server.mount(contract.experiments.getExperimentVisualization, {
        body: defaultVisualization(),
        delay: 999_999,
      });
      server.mount(contract.experiments.getExperimentTables, {
        body: [],
        delay: 999_999,
      });

      render(<EditVisualizationPage />);

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });
  });
});
