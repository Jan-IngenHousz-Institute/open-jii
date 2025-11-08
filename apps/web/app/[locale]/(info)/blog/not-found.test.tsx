import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import NotFound from "./not-found";

globalThis.React = React;

// --- Mocks ---
const mockInitTranslations = vi.fn();
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: (params: { locale: string }): unknown => mockInitTranslations(params),
}));

vi.mock("@repo/cms/container", () => ({
  Container: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="container">{children}</div>
  ),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="link">
      {children}
    </a>
  ),
}));

// --- Tests ---
describe("BlogNotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitTranslations.mockResolvedValue({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "notFound.title": "Page Not Found",
          "notFound.description": "The page you're looking for doesn't exist. ",
          "common.description": "Go back home",
        };
        return translations[key] || key;
      },
    });
  });

  it("renders the not found page with all components", async () => {
    render(await NotFound());

    expect(screen.getByTestId("container")).toBeInTheDocument();
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText(/The page you're looking for doesn't exist/)).toBeInTheDocument();
    expect(screen.getByTestId("link")).toBeInTheDocument();
  });

  it("renders title in h1 element", async () => {
    const { container } = render(await NotFound());

    // Check h1 element
    const h1Element = container.querySelector("h1");
    expect(h1Element).toBeInTheDocument();
    expect(h1Element).toHaveClass("h2");
    expect(h1Element).toHaveTextContent("Page Not Found");
  });

  it("renders description paragraph with correct text", async () => {
    render(await NotFound());

    const description = screen.getByText(/The page you're looking for doesn't exist/);
    expect(description).toBeInTheDocument();
    expect(description.tagName).toBe("P");
    expect(description).toHaveClass("mt-4");
  });

  it("renders link with correct href and styling", async () => {
    render(await NotFound());

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("text-blue500");
    expect(link).toHaveTextContent("Go back home");
  });

  it("uses hardcoded en-US locale", async () => {
    render(await NotFound());

    // Verify that initTranslations was called with en-US locale
    expect(mockInitTranslations).toHaveBeenCalledWith({ locale: "en-US" });
  });

  it("handles translation function correctly", async () => {
    // Mock different translations
    mockInitTranslations.mockResolvedValueOnce({
      t: (key: string) => `Translated: ${key}`,
    });

    render(await NotFound());

    expect(screen.getByText("Translated: notFound.title")).toBeInTheDocument();
    expect(screen.getByText(/Translated: notFound.description/)).toBeInTheDocument();
    expect(screen.getByText("Translated: common.description")).toBeInTheDocument();
  });
});
