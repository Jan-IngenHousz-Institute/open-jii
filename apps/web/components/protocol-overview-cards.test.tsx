import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ProtocolOverviewCards } from "./protocol-overview-cards";

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
    <a
      href={href}
      data-testid="protocol-link"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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
        "protocols.noProtocols": "No protocols found",
        "protocols.lastUpdate": "Last update",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" className={className} data-variant={variant}>
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

// Mock useProtocolCompatibleMacros hook (uses tsr.*.useQuery which requires QueryClient)
const mockUseProtocolCompatibleMacros = vi.fn<
  (protocolId: string, enabled?: boolean) => { data: { body: unknown[] }; isLoading: boolean }
>(() => ({
  data: { body: [] },
  isLoading: false,
}));
vi.mock("@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: (protocolId: string, enabled?: boolean) =>
    mockUseProtocolCompatibleMacros(protocolId, enabled),
}));

const mockProtocols = [
  {
    id: "protocol1",
    name: "Fv/FM Baseline",
    description: "Dark adaptation protocol",
    code: [{ step: 1 }],
    family: "multispeq" as const,
    sortOrder: null,
    createdBy: "user1",
    createdByName: "User One",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-15T00:00:00Z",
  },
  {
    id: "protocol2",
    name: "Ambient Light",
    description: "Measure ambient light",
    code: [{ step: 2 }],
    family: "ambit" as const,
    sortOrder: null,
    createdBy: "user2",
    createdByName: "User Two",
    createdAt: "2023-02-01T00:00:00Z",
    updatedAt: "2023-02-15T00:00:00Z",
  },
  {
    id: "protocol3",
    name: "PAM Fluorometry",
    description: "Pulse amplitude modulation",
    code: [{ step: 3 }],
    family: "multispeq" as const,
    sortOrder: 1,
    createdBy: "user3",
    createdByName: "User Three",
    createdAt: "2023-03-01T00:00:00Z",
    updatedAt: "2023-03-15T00:00:00Z",
  },
];

describe("<ProtocolOverviewCards />", () => {
  it("renders loading state when protocols is undefined", () => {
    const { container } = render(<ProtocolOverviewCards protocols={undefined} />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders 'no protocols' message when protocols array is empty", () => {
    render(<ProtocolOverviewCards protocols={[]} />);
    expect(screen.getByText("No protocols found")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a grid of protocol cards", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const links = screen.getAllByTestId("protocol-link");
    expect(links).toHaveLength(3);
    expect(screen.getByText("Fv/FM Baseline")).toBeInTheDocument();
    expect(screen.getByText("Ambient Light")).toBeInTheDocument();
    expect(screen.getByText("PAM Fluorometry")).toBeInTheDocument();
  });

  it("renders correct family badges", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    expect(screen.getAllByText("multispeq")).toHaveLength(2);
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("renders description via RichTextRenderer", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const richTexts = screen.getAllByTestId("rich-text");
    expect(richTexts).toHaveLength(3);
    expect(richTexts[0]).toHaveTextContent("Dark adaptation protocol");
  });

  it("displays last update date", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const updateTexts = screen.getAllByText(/Last update:/);
    expect(updateTexts).toHaveLength(3);
  });

  it("renders preferred badge for protocol with sortOrder", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    expect(screen.getByText("Preferred")).toBeInTheDocument();
  });

  it("renders chevron icons", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const chevrons = screen.getAllByTestId("icon-chevron-right");
    expect(chevrons).toHaveLength(3);
  });

  it("creates links with locale prefix", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const links = screen.getAllByTestId("protocol-link");
    expect(links[0]).toHaveAttribute("href", "/en/platform/protocols/protocol1");
    expect(links[1]).toHaveAttribute("href", "/en/platform/protocols/protocol2");
    expect(links[2]).toHaveAttribute("href", "/en/platform/protocols/protocol3");
  });

  it("passes enabled=true to useProtocolCompatibleMacros on hover", () => {
    mockUseProtocolCompatibleMacros.mockClear();
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const links = screen.getAllByTestId("protocol-link");
    fireEvent.mouseEnter(links[0]);
    expect(mockUseProtocolCompatibleMacros).toHaveBeenCalledWith("protocol1", true);
  });

  it("renders compatible macro names when hook returns data", () => {
    mockUseProtocolCompatibleMacros.mockReturnValue({
      data: {
        body: [
          { macro: { id: "m1", name: "Python Macro" } },
          { macro: { id: "m2", name: "R Macro" } },
        ],
      },
      isLoading: false,
    });
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    const links = screen.getAllByTestId("protocol-link");
    fireEvent.mouseEnter(links[0]);
    expect(screen.getAllByText("Python Macro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R Macro").length).toBeGreaterThan(0);
    mockUseProtocolCompatibleMacros.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
  });

  it("does not render compatible macros section when hook returns empty array", () => {
    mockUseProtocolCompatibleMacros.mockReturnValue({
      data: { body: [] },
      isLoading: false,
    });
    render(<ProtocolOverviewCards protocols={mockProtocols} />);
    expect(screen.queryByText("Python Macro")).not.toBeInTheDocument();
  });
});
