import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
// Required: auto JSX transform not active in vitest
import { describe, it, expect, vi } from "vitest";

import { MacroOverviewCards } from "./macro-overview-cards";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onMouseEnter,
    onMouseLeave,
  }: {
    href: string;
    children: React.ReactNode;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
  }) => (
    <a href={href} data-testid="macro-link" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </a>
  ),
}));

// Mock useLocale
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.preferred": "Preferred",
        "macros.noMacros": "No macros found",
        "macros.lastUpdate": "Last update",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text">{content}</div>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={`animate-pulse ${className}`} />
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
}));

// Mock cva
vi.mock("@repo/ui/lib/utils", () => ({
  cva:
    (base: string) =>
    ({ featured }: { featured?: boolean } = {}) =>
      featured ? `${base} featured` : base,
}));

// Mock useMacroCompatibleProtocols hook (uses tsr.*.useQuery which requires QueryClient)
const mockUseMacroCompatibleProtocols = vi.fn<
  (macroId: string, enabled?: boolean) => { data: { body: unknown[] }; isLoading: boolean }
>(() => ({
  data: { body: [] },
  isLoading: false,
}));
vi.mock("@/hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols", () => ({
  useMacroCompatibleProtocols: (macroId: string, enabled?: boolean) =>
    mockUseMacroCompatibleProtocols(macroId, enabled),
}));

const mockMacros = [
  {
    id: "macro1",
    name: "Python Macro",
    description: "A Python macro for data analysis",
    language: "python" as const,
    code: "python_macro.py",
    filename: "python_macro.py",
    sortOrder: null,
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
    sortOrder: null,
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
    sortOrder: 1,
    createdBy: "user3",
    createdByName: "User Three",
    createdAt: "2023-03-01T00:00:00Z",
    updatedAt: "2023-03-15T00:00:00Z",
  },
];

describe("<MacroOverviewCards />", () => {
  it("renders loading state when isLoading is true", () => {
    const { container } = render(<MacroOverviewCards macros={[]} isLoading={true} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty message when no macros", () => {
    render(<MacroOverviewCards macros={[]} isLoading={false} />);
    expect(screen.getByText("No macros found")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders 'no macros' message when macros is undefined", () => {
    render(<MacroOverviewCards macros={undefined} isLoading={false} />);
    expect(screen.getByText("No macros found")).toBeInTheDocument();
  });

  it("renders a grid of macro cards", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const links = screen.getAllByTestId("macro-link");
    expect(links).toHaveLength(3);
    expect(screen.getByText("Python Macro")).toBeInTheDocument();
    expect(screen.getByText("R Macro")).toBeInTheDocument();
    expect(screen.getByText("JavaScript Macro")).toBeInTheDocument();
  });

  it("renders correct language badges", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("renders description via RichTextRenderer", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const richTexts = screen.getAllByTestId("rich-text");
    expect(richTexts).toHaveLength(3);
    expect(richTexts[0]).toHaveTextContent("A Python macro for data analysis");
  });

  it("displays last update date", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const updateTexts = screen.getAllByText(/Last update:/);
    expect(updateTexts).toHaveLength(3);
  });

  it("renders preferred badge for macro with sortOrder", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    expect(screen.getByText("Preferred")).toBeInTheDocument();
  });

  it("renders chevron icons", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const chevrons = screen.getAllByTestId("icon-chevron-right");
    expect(chevrons).toHaveLength(3);
  });

  it("creates links with locale prefix", () => {
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const links = screen.getAllByTestId("macro-link");
    expect(links[0]).toHaveAttribute("href", "/en/platform/macros/macro1");
    expect(links[1]).toHaveAttribute("href", "/en/platform/macros/macro2");
    expect(links[2]).toHaveAttribute("href", "/en/platform/macros/macro3");
  });

  it("passes enabled=true to useMacroCompatibleProtocols on hover", () => {
    mockUseMacroCompatibleProtocols.mockClear();
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const links = screen.getAllByTestId("macro-link");
    fireEvent.mouseEnter(links[0]);
    expect(mockUseMacroCompatibleProtocols).toHaveBeenCalledWith("macro1", true);
  });

  it("renders compatible protocol names as badges when hook returns data", () => {
    mockUseMacroCompatibleProtocols.mockReturnValue({
      data: {
        body: [
          { protocol: { id: "p1", name: "Fv/FM Baseline" } },
          { protocol: { id: "p2", name: "Ambient Light" } },
        ],
      },
      isLoading: false,
    });
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    const links = screen.getAllByTestId("macro-link");
    fireEvent.mouseEnter(links[0]);
    expect(screen.getAllByText("Fv/FM Baseline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ambient Light").length).toBeGreaterThan(0);
    mockUseMacroCompatibleProtocols.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
  });

  it("does not render compatible protocols section when hook returns empty array", () => {
    mockUseMacroCompatibleProtocols.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
    render(<MacroOverviewCards macros={mockMacros} isLoading={false} />);
    // No protocol badge spans from CompatibleProtocolsList should be present
    expect(screen.queryByText("Fv/FM Baseline")).not.toBeInTheDocument();
  });
});
