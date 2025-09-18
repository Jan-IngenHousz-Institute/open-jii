import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { MacroOverviewCards } from "./macro-overview-cards";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="macro-link">
      {children}
    </a>
  ),
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock formatDate
vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ArrowRight: () => <div data-testid="icon-arrow-right" />,
  Calendar: () => <div data-testid="icon-calendar" />,
  User: () => <div data-testid="icon-user" />,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    variant,
    className,
    children,
  }: {
    variant: string;
    className: string;
    children: React.ReactNode;
  }) => (
    <button data-testid="button" data-variant={variant} className={className}>
      {children}
    </button>
  ),
  Card: ({ className, children }: { className: string; children: React.ReactNode }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
}));

describe("<MacroOverviewCards />", () => {
  const mockMacros = [
    {
      id: "macro1",
      name: "Python Macro",
      description: "A Python macro for data analysis",
      language: "python" as const,
      code: "python_macro.py",
      filename: "python_macro.py",
      createdBy: "user1",
      createdByName: "User One",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-15T00:00:00Z",
    },
    {
      id: "macro2",
      name: "R Macro",
      description: "An R macro for statistical analysis",
      language: "r" as const,
      code: "r_macro.r",
      filename: "r_macro.r",
      createdBy: "user2",
      createdByName: "User Two",
      createdAt: "2023-02-01T00:00:00Z",
      updatedAt: "2023-02-15T00:00:00Z",
    },
    {
      id: "macro3",
      name: "JavaScript Macro",
      description: "A JavaScript macro for visualization",
      language: "javascript" as const,
      code: "js_macro.js",
      filename: "js_macro.js",
      createdBy: "user3",
      createdByName: "User Three",
      createdAt: "2023-03-01T00:00:00Z",
      updatedAt: "2023-03-15T00:00:00Z",
    },
  ];

  it("renders loading state when isLoading is true", () => {
    render(<MacroOverviewCards macros={[]} isLoading={true} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("renders 'no macros' message when macros array is empty", () => {
    render(<MacroOverviewCards macros={[]} isLoading={false} />);

    expect(screen.getByText("macros.noMacros")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("renders 'no macros' message when macros is undefined", () => {
    render(<MacroOverviewCards macros={undefined} isLoading={false} />);

    expect(screen.getByText("macros.noMacros")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("renders a grid of macro cards when macros are provided", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);

    // Check that we have 3 cards
    const cards = screen.getAllByTestId("card");
    expect(cards).toHaveLength(3);

    // Check that all macro names are displayed
    expect(screen.getByText("Python Macro")).toBeInTheDocument();
    expect(screen.getByText("R Macro")).toBeInTheDocument();
    expect(screen.getByText("JavaScript Macro")).toBeInTheDocument();
  });

  it("renders correct language badges with appropriate styles", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);

    // Check that language badges are displayed with correct text
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    // Note: We can't easily test the exact class names in this test setup
    // as the component combines dynamic class names
  });

  it("renders creator name and update date information", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);

    // Check for creator names
    expect(screen.getByText("User One")).toBeInTheDocument();
    expect(screen.getByText("User Two")).toBeInTheDocument();
    expect(screen.getByText("User Three")).toBeInTheDocument();

    // Check for formatted dates - using regex to match text content that contains the formatted date
    expect(screen.getByText(/formatted-2023-01-15T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-02-15T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-03-15T00:00:00Z/)).toBeInTheDocument();

    // Check for the "common.updated" text using getAllByText since there are multiple instances
    expect(screen.getAllByText(/common\.updated/)).toHaveLength(3);
  });

  it("renders view details buttons", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);

    const buttons = screen.getAllByTestId("button");
    expect(buttons).toHaveLength(3);

    // Check that each button has the correct text
    buttons.forEach((button) => {
      expect(button).toHaveTextContent("macros.viewDetails");
    });

    // Check for arrow icons
    expect(screen.getAllByTestId("icon-arrow-right")).toHaveLength(3);
  });

  it("creates links to individual macro pages", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);

    const links = screen.getAllByTestId("macro-link");
    expect(links).toHaveLength(3);

    // Check that links have the correct hrefs
    expect(links[0]).toHaveAttribute("href", "/platform/macros/macro1");
    expect(links[1]).toHaveAttribute("href", "/platform/macros/macro2");
    expect(links[2]).toHaveAttribute("href", "/platform/macros/macro3");
  });
});
