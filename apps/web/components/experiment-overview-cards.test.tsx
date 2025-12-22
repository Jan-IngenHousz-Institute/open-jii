import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Experiment } from "@repo/api";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

// Mock the useTranslation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experiments.loadingExperiments": "Loading experiments...",
        "experiments.noExperiments": "No experiments found",
        lastUpdate: "Last update",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock ExperimentStatusBadge
vi.mock("~/components/ExperimentStatusBadge", () => ({
  ExperimentStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

// Mock RichTextRenderer
vi.mock("@repo/ui/components", () => ({
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text">{content}</div>
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ChevronRight: () => <svg data-testid="chevron-right" />,
}));

const mockExperiment: Experiment = {
  id: "1",
  name: "Test Experiment",
  description: "Test description",
  status: "active",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
  metadata: {},
  members: [],
  organizationId: "org-1",
};

describe("ExperimentOverviewCards", () => {
  describe("loading state", () => {
    it("renders loading message when experiments is undefined", () => {
      render(<ExperimentOverviewCards experiments={undefined} />);
      expect(screen.getByText("Loading experiments...")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders no experiments message when array is empty", () => {
      render(<ExperimentOverviewCards experiments={[]} />);
      expect(screen.getByText("No experiments found")).toBeInTheDocument();
    });
  });

  describe("horizontal layout", () => {
    it("renders experiments in horizontal layout", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} horizontal />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
    });

    it("uses correct path for regular experiments", () => {
      const { container } = render(
        <ExperimentOverviewCards experiments={[mockExperiment]} horizontal />,
      );
      const link = container.querySelector('a[href="/platform/experiments/1"]');
      expect(link).toBeInTheDocument();
    });

    it("uses correct path for archived experiments", () => {
      const { container } = render(
        <ExperimentOverviewCards experiments={[mockExperiment]} horizontal archived />,
      );
      const link = container.querySelector('a[href="/platform/experiments-archive/1"]');
      expect(link).toBeInTheDocument();
    });

    it("renders multiple experiments", () => {
      const experiments: Experiment[] = [
        mockExperiment,
        { ...mockExperiment, id: "2", name: "Second Experiment" },
        { ...mockExperiment, id: "3", name: "Third Experiment" },
      ];
      render(<ExperimentOverviewCards experiments={experiments} horizontal />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Second Experiment")).toBeInTheDocument();
      expect(screen.getByText("Third Experiment")).toBeInTheDocument();
    });

    it("displays formatted last update date", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} horizontal />);
      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });

    it("renders ChevronRight icon", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} horizontal />);
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("handles experiment with null description", () => {
      const experimentWithoutDesc = { ...mockExperiment, description: null };
      render(<ExperimentOverviewCards experiments={[experimentWithoutDesc]} horizontal />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text")).toBeInTheDocument();
    });
  });

  describe("vertical layout (default)", () => {
    it("renders experiments in vertical layout by default", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
    });

    it("renders experiments in vertical layout when horizontal is false", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} horizontal={false} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("uses correct path for regular experiments", () => {
      const { container } = render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      const link = container.querySelector('a[href="/platform/experiments/1"]');
      expect(link).toBeInTheDocument();
    });

    it("uses correct path for archived experiments", () => {
      const { container } = render(
        <ExperimentOverviewCards experiments={[mockExperiment]} archived />,
      );
      const link = container.querySelector('a[href="/platform/experiments-archive/1"]');
      expect(link).toBeInTheDocument();
    });

    it("renders multiple experiments in vertical layout", () => {
      const experiments: Experiment[] = [
        mockExperiment,
        { ...mockExperiment, id: "2", name: "Second Experiment" },
      ];
      render(<ExperimentOverviewCards experiments={experiments} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Second Experiment")).toBeInTheDocument();
    });

    it("displays formatted last update date in vertical layout", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });

    it("renders ChevronRight icon in vertical layout", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("handles experiment with null description in vertical layout", () => {
      const experimentWithoutDesc = { ...mockExperiment, description: null };
      render(<ExperimentOverviewCards experiments={[experimentWithoutDesc]} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text")).toBeInTheDocument();
    });
  });

  describe("different experiment statuses", () => {
    it("renders experiment with provisioning status", () => {
      const experiment = { ...mockExperiment, status: "provisioning" as const };
      render(<ExperimentOverviewCards experiments={[experiment]} horizontal />);
      expect(screen.getByTestId("status-badge")).toHaveTextContent("provisioning");
    });

    it("renders experiment with archived status", () => {
      const experiment = { ...mockExperiment, status: "archived" as const };
      render(<ExperimentOverviewCards experiments={[experiment]} horizontal />);
      expect(screen.getByTestId("status-badge")).toHaveTextContent("archived");
    });

    it("renders experiment with stale status", () => {
      const experiment = { ...mockExperiment, status: "stale" as const };
      render(<ExperimentOverviewCards experiments={[experiment]} horizontal />);
      expect(screen.getByTestId("status-badge")).toHaveTextContent("stale");
    });
  });
});
