import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/list-experiments", () => ({
  ListExperiments: () => <div data-testid="list-experiments">List of Experiments</div>,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    locale,
  }: {
    children: React.ReactNode;
    href: string;
    locale: string;
  }) => (
    <a href={href} data-testid="link" data-locale={locale}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <button data-testid="button" data-variant={variant}>
      {children}
    </button>
  ),
}));

// --- Tests ---
describe("ExperimentPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the experiments page with all components", async () => {
    render(await ExperimentPage(defaultProps));

    expect(screen.getByText("experiments.title")).toBeInTheDocument();
    expect(screen.getByText("experiments.listDescription")).toBeInTheDocument();
    expect(screen.getByTestId("list-experiments")).toBeInTheDocument();
    expect(screen.getAllByTestId("button")).toHaveLength(3);
    expect(screen.getAllByTestId("link")).toHaveLength(3);
  });

  it("renders the create new experiment button with correct text", async () => {
    render(await ExperimentPage(defaultProps));

    const createButton = screen.getByText("experiments.create");
    expect(createButton).toBeInTheDocument();
    expect(createButton.tagName).toBe("BUTTON");
  });

  it("renders archive link with correct href and locale", async () => {
    render(await ExperimentPage(defaultProps));

    const archiveButton = screen.getByText("experiments.viewArchived");
    expect(archiveButton).toBeInTheDocument();
    expect(archiveButton.tagName).toBe("BUTTON");
    expect(archiveButton).toHaveAttribute("data-variant", "link");

    const archiveLink = archiveButton.closest("a");
    expect(archiveLink).toHaveAttribute("href", "/en-US/platform/experiments-archive");
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(await ExperimentPage(defaultProps));

    const mainDiv = container.querySelector(".space-y-6");
    expect(mainDiv).toBeInTheDocument();

    const headerDiv = container.querySelector(".flex.flex-col.gap-2.md\\:flex-row");
    expect(headerDiv).toBeInTheDocument();
  });

  it("renders title and description in header section", async () => {
    const { container } = render(await ExperimentPage(defaultProps));

    const titleElement = container.querySelector("h1");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass("text-lg", "font-medium");
    expect(titleElement).toHaveTextContent("experiments.title");

    const descriptionElement = container.querySelector("p");
    expect(descriptionElement).toBeInTheDocument();
    expect(descriptionElement).toHaveTextContent("experiments.listDescription");
  });

  it("handles different locale", async () => {
    const germanProps = {
      params: Promise.resolve({ locale: "de" }),
    };

    render(await ExperimentPage(germanProps));

    const createLink = screen.getByRole("link", { name: /experiments.create/ });
    expect(createLink).toHaveAttribute("data-locale", "de");
  });
});
