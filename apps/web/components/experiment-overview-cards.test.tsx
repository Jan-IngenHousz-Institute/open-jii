import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import type { Experiment } from "@repo/api";

import { ExperimentOverviewCards } from "./experiment-overview-cards";

// Mock the useTranslation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
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

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text">{content}</div>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={`animate-pulse ${className}`} />
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
  visibility: "private",
  createdBy: "user-1",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
  embargoUntil: "2025-12-31T23:59:59.999Z",
  ownerFirstName: "John",
  ownerLastName: "Doe",
};

describe("ExperimentOverviewCards", () => {
  it("shows skeleton loaders while experiments are loading", () => {
    const { container } = render(<ExperimentOverviewCards experiments={undefined} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows an empty message when there are no experiments", () => {
    render(<ExperimentOverviewCards experiments={[]} />);
    expect(screen.getByText("experiments.noExperiments")).toBeInTheDocument();
  });

  describe("card rendering", () => {
    it("renders experiments with name, description, and status badge", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
      expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
    });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    it("uses correct path for archived experiments", () => {
      const { container } = render(
        <ExperimentOverviewCards experiments={[mockExperiment]} archived />,
      );
      const link = container.querySelector('a[href="/platform/experiments-archive/1"]');
      expect(link).toBeInTheDocument();
    });

    it("renders multiple experiments", () => {
      const experiments: Experiment[] = [
        mockExperiment,
        { ...mockExperiment, id: "2", name: "Second Experiment" },
      ];
      render(<ExperimentOverviewCards experiments={experiments} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("Second Experiment")).toBeInTheDocument();
    });

    it("displays last update date", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    });

    it("renders ChevronRight icon", () => {
      render(<ExperimentOverviewCards experiments={[mockExperiment]} />);
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("handles experiment with null description", () => {
      const experimentWithoutDesc = { ...mockExperiment, description: null };
      render(<ExperimentOverviewCards experiments={[experimentWithoutDesc]} />);
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
      expect(screen.getByTestId("rich-text")).toBeInTheDocument();
    });
  });

  it("links each card to the experiment detail page", () => {
    const experiment = createExperiment({ id: "abc-123" });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/experiments/abc-123");
  });

  it("links to the archive path when archived prop is set", () => {
    const experiment = createExperiment({ id: "abc-123" });

    render(<ExperimentOverviewCards experiments={[experiment]} archived />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/experiments-archive/abc-123");
  });

  it("renders multiple experiment cards", () => {
    const experiments = [
      createExperiment({ name: "Study A" }),
      createExperiment({ name: "Study B" }),
      createExperiment({ name: "Study C" }),
    ];

    render(<ExperimentOverviewCards experiments={experiments} />);

    expect(screen.getByText("Study A")).toBeInTheDocument();
    expect(screen.getByText("Study B")).toBeInTheDocument();
    expect(screen.getByText("Study C")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("shows the last-updated date", () => {
    const experiment = createExperiment({
      updatedAt: "2025-06-15T00:00:00.000Z",
    });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    // The date format depends on locale, but the translation key should appear
    expect(screen.getByText(/lastUpdate/)).toBeInTheDocument();
  });

  it("gracefully handles a null description", () => {
    const experiment = createExperiment({ description: null });

    render(<ExperimentOverviewCards experiments={[experiment]} />);

    // Should still render the card without crashing
    expect(screen.getByText(experiment.name)).toBeInTheDocument();
  });
});
