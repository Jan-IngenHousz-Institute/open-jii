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
  it("shows skeleton loaders while loading", () => {
    render(<ExperimentOverviewCards experiments={undefined} />);
    // Loading state: no experiment content or empty-state message
    expect(screen.queryByText("experiments.noExperiments")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows empty message when no experiments", () => {
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

  it("links to the correct experiment page", () => {
    render(<ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/platform/experiments/abc-123");
  });

  it("links to archive path when archived", () => {
    render(
      <ExperimentOverviewCards experiments={[createExperiment({ id: "abc-123" })]} archived />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/platform/experiments-archive/abc-123",
    );
  });

  it("renders multiple cards", () => {
    const exps = [
      createExperiment({ name: "A" }),
      createExperiment({ name: "B" }),
      createExperiment({ name: "C" }),
    ];
    render(<ExperimentOverviewCards experiments={exps} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("shows last-updated date", () => {
    render(
      <ExperimentOverviewCards
        experiments={[createExperiment({ updatedAt: "2025-06-15T00:00:00.000Z" })]}
      />,
    );
    expect(screen.getByText(/lastUpdate/)).toBeInTheDocument();
  });

  it("handles null description gracefully", () => {
    const exp = createExperiment({ description: null });
    render(<ExperimentOverviewCards experiments={[exp]} />);
    expect(screen.getByText(exp.name)).toBeInTheDocument();
  });
});
