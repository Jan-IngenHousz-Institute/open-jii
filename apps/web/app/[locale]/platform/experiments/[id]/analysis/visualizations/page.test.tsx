import { createExperimentAccess, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound, useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import VisualizationsPage from "./page";

vi.mock("~/components/experiment-visualizations/experiment-visualizations-list", () => ({
  default: ({
    experimentId,
    visualizations,
    isLoading,
  }: {
    experimentId: string;
    visualizations: { id: string; name: string }[];
    isLoading: boolean;
  }) => (
    <div data-testid="visualizations-list" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      {visualizations.map((viz) => (
        <div key={viz.id} data-testid={`viz-${viz.id}`}>
          {viz.name}
        </div>
      ))}
    </div>
  ),
}));

const accessPayload = createExperimentAccess({
  experiment: { id: "exp-123", status: "active" },
  isAdmin: true,
});

function mountDefaults(visualizations: unknown[] = []) {
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.experiments.listExperimentVisualizations, {
    body: visualizations,
  });
}

describe("VisualizationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: "exp-123" });
  });

  describe("Successful loading state", () => {
    it("should render visualizations list", async () => {
      const mockVisualizations = [
        createVisualization({ id: "viz-1", name: "Temperature Over Time" }),
        createVisualization({ id: "viz-2", name: "Humidity Analysis" }),
      ];
      mountDefaults(mockVisualizations);

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
        expect(screen.getByTestId("viz-viz-1")).toBeInTheDocument();
      });
      expect(screen.getByText("Temperature Over Time")).toBeInTheDocument();
      expect(screen.getByTestId("viz-viz-2")).toBeInTheDocument();
      expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    });

    it("should render page title", async () => {
      mountDefaults();

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByText("ui.title")).toBeInTheDocument();
      });
    });

    it("should render create button", async () => {
      mountDefaults();

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByText("ui.actions.create")).toBeInTheDocument();
      });
    });

    it("should render create button with icon", async () => {
      mountDefaults();

      render(<VisualizationsPage />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /ui.actions.create/ });
        expect(button.querySelector("svg")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate to new visualization page when create button is clicked", async () => {
      const user = userEvent.setup();
      mountDefaults();

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button");
      await user.click(createButton);

      const mockRouter = vi.mocked(useRouter)();
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining("exp-123"));
      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("analysis/visualizations/new"),
      );
    });
  });

  describe("Empty state", () => {
    it("should render with no visualizations", async () => {
      mountDefaults([]);

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
      });
      expect(screen.queryByTestId(/^viz-/)).not.toBeInTheDocument();
    });

    it("should still show create button when no visualizations exist", async () => {
      mountDefaults([]);

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByText("ui.actions.create")).toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("should pass loading state to list component", () => {
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
      server.mount(contract.experiments.listExperimentVisualizations, {
        body: [],
        delay: 999_999,
      });

      render(<VisualizationsPage />);

      const list = screen.getByTestId("visualizations-list");
      expect(list.getAttribute("data-loading")).toBe("true");
    });
  });

  describe("Multiple visualizations", () => {
    it("should render many visualizations", async () => {
      const mockVisualizations = Array.from({ length: 10 }, (_, i) =>
        createVisualization({ id: `viz-${i}`, name: `Visualization ${i}` }),
      );
      mountDefaults(mockVisualizations);

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("viz-viz-0")).toBeInTheDocument();
      });

      for (const viz of mockVisualizations) {
        expect(screen.getByTestId(`viz-${viz.id}`)).toBeInTheDocument();
        expect(screen.getByText(viz.name)).toBeInTheDocument();
      }
    });
  });

  describe("Component integration", () => {
    it("should pass correct experiment ID to list component", async () => {
      mountDefaults();

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
      });
    });
  });

  describe("Archived experiment handling", () => {
    it("should call notFound when experiment is archived", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({
          experiment: { status: "archived" },
        }),
      });
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      render(<VisualizationsPage />);

      await waitFor(() => {
        expect(notFound).toHaveBeenCalled();
      });
    });
  });
});
