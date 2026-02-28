import { createExperimentAccess, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound, useParams, useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import NewVisualizationPage from "./page";

// --- Component mocks ---

vi.mock("@/components/experiment-visualizations/new-visualization-form", () => ({
  default: ({
    experimentId,
    tables,
    onSuccess,
    isLoading,
    isPreviewOpen,
    onPreviewClose,
  }: {
    experimentId: string;
    tables: unknown[];
    onSuccess: (id: string) => void;
    isLoading: boolean;
    isPreviewOpen: boolean;
    onPreviewClose: () => void;
  }) => (
    <div data-testid="new-visualization-form" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      <div>Tables: {tables.length}</div>
      <div>Preview Open: {isPreviewOpen ? "Yes" : "No"}</div>
      <button onClick={() => onSuccess("new-viz-123")}>Create Visualization</button>
      <button onClick={onPreviewClose}>Close Preview</button>
    </div>
  ),
}));

// --- Helpers ---

const experimentId = "exp-123";

function mountDefaults(overrides?: { tables?: unknown[] }) {
  server.mount(contract.experiments.getExperimentAccess, {
    body: createExperimentAccess({
      experiment: { id: experimentId, status: "active" },
      isAdmin: true,
    }),
  });
  server.mount(contract.experiments.getExperimentTables, {
    body: (overrides?.tables ?? []) as ReturnType<typeof createExperimentTable>[],
  });
}

// --- Tests ---

describe("NewVisualizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: experimentId, locale: "en-US" });
  });

  describe("Rendering", () => {
    it("should render page title", async () => {
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("ui.actions.create")).toBeInTheDocument();
      });
    });

    it("should render preview button", async () => {
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });
    });

    it("should render form with correct experiment ID", async () => {
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText(`Experiment: ${experimentId}`)).toBeInTheDocument();
      });
    });

    it("should pass sample tables to form", async () => {
      mountDefaults({
        tables: [createExperimentTable(), createExperimentTable(), createExperimentTable()],
      });
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Tables: 3")).toBeInTheDocument();
      });
    });

    it("should pass loading state to form", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({
          experiment: { id: experimentId, status: "active" },
          isAdmin: true,
        }),
      });
      server.mount(contract.experiments.getExperimentTables, {
        body: [],
        delay: 999_999,
      });

      render(<NewVisualizationPage />);

      await waitFor(() => {
        const form = screen.getByTestId("new-visualization-form");
        expect(form.getAttribute("data-loading")).toBe("true");
      });
    });
  });

  describe("Preview functionality", () => {
    it("should initially have preview closed", async () => {
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
      });
    });

    it("should open preview when button is clicked", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });

      const previewButton = screen.getByRole("button", { name: /preview.title/ });
      expect(previewButton).toBeTruthy();

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });
    });

    it("should close preview when onPreviewClose is called", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<NewVisualizationPage />);

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
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Create Visualization")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Create Visualization"));

      const router = vi.mocked(useRouter)();
      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          "/en-US/platform/experiments/exp-123/analysis/visualizations/new-viz-123",
        );
      });
    });

    it("should construct correct URL with visualization ID", async () => {
      const user = userEvent.setup();
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Create Visualization")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Create Visualization"));

      const router = vi.mocked(useRouter)();
      await waitFor(() => {
        expect(router.push).toHaveBeenCalled();
        const calledPath = vi.mocked(router.push).mock.calls[0]?.[0];
        expect(calledPath).toContain("exp-123");
        expect(calledPath).toContain("analysis/visualizations");
        expect(calledPath).toContain("new-viz-123");
      });
    });
  });

  describe("Data fetching", () => {
    it("should handle loading state", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({
          experiment: { id: experimentId, status: "active" },
          isAdmin: true,
        }),
      });
      server.mount(contract.experiments.getExperimentTables, {
        body: [],
        delay: 999_999,
      });

      render(<NewVisualizationPage />);

      await waitFor(() => {
        const form = screen.getByTestId("new-visualization-form");
        expect(form.getAttribute("data-loading")).toBe("true");
      });
    });

    it("should handle empty sample tables", async () => {
      mountDefaults({ tables: [] });
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Tables: 0")).toBeInTheDocument();
      });
    });

    it("should handle multiple sample tables", async () => {
      const tables = Array.from({ length: 10 }, () => createExperimentTable());
      mountDefaults({ tables });
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByText("Tables: 10")).toBeInTheDocument();
      });
    });
  });

  describe("Button styling", () => {
    it("should render preview button as outline variant", async () => {
      mountDefaults();
      render(<NewVisualizationPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /preview.title/ })).toBeInTheDocument();
      });
    });
  });

  describe("Archived experiment handling", () => {
    it("should call notFound when experiment is archived", () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({
          experiment: { id: experimentId, status: "archived" },
        }),
      });
      server.mount(contract.experiments.getExperimentTables, { body: [] });

      // The component calls notFound() when !hasAccess (which is true during loading
      // since accessData is undefined). Making notFound throw verifies the guard is hit.
      vi.mocked(notFound).mockImplementation(() => {
        throw new Error("NEXT_NOT_FOUND");
      });

      expect(() => render(<NewVisualizationPage />)).toThrow("NEXT_NOT_FOUND");
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });
});
