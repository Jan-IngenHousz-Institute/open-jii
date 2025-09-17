import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect } from "vitest";

import MacroPage from "../page";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    locale,
  }: {
    children: React.ReactNode;
    href: string;
    locale: string;
  }) => (
    <a href={href} data-locale={locale} data-testid="link">
      {children}
    </a>
  ),
}));

// Mock the initTranslations function
vi.mock("@repo/i18n/server", () => ({
  default: vi.fn().mockResolvedValue({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "macros.title": "Macros",
        "macros.listDescription": "Manage and create your macros here",
        "macros.create": "Create New Macro",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the ListMacros component
vi.mock("@/components/list-macros", () => ({
  ListMacros: () => <div data-testid="list-macros">List of macros</div>,
}));

// Mock the Button component
vi.mock("@repo/ui/components", () => ({
  Button: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <button data-testid="button" data-variant={variant}>
      {children}
    </button>
  ),
}));

describe("MacroPage", () => {
  const mockParams = Promise.resolve({ locale: "en-US" as const });

  it("should render the page title and description", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    expect(screen.getByText("Macros")).toBeInTheDocument();
    expect(screen.getByText("Manage and create your macros here")).toBeInTheDocument();
  });

  it("should render the create macro button with correct link", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("href", "/platform/macros/new");
    expect(link).toHaveAttribute("data-locale", "en-US");

    const button = screen.getByTestId("button");
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveTextContent("Create New Macro");
  });

  it("should render the ListMacros component", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    expect(screen.getByTestId("list-macros")).toBeInTheDocument();
    expect(screen.getByText("List of macros")).toBeInTheDocument();
  });

  it("should handle different locale", async () => {
    const germanParams = Promise.resolve({ locale: "de-DE" as const });
    const result = await MacroPage({ params: germanParams });
    render(result);

    const link = screen.getByTestId("link");
    expect(link).toHaveAttribute("data-locale", "de-DE");
  });

  it("should have proper page structure", async () => {
    const result = await MacroPage({ params: mockParams });
    render(result);

    // Check for main container exists
    const container = screen.getByText("Macros").closest("div");
    expect(container).toBeInTheDocument();

    // Check for proper heading structure
    const heading = screen.getByText("Macros");
    expect(heading.tagName).toBe("H1");
    expect(heading).toBeInTheDocument();
  });
});
