import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ProtocolOverviewPage from "../page";

globalThis.React = React;

// Mock React's use function to resolve the params promise synchronously
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "proto-1" }),
  };
});

// --------------------
// Mocks
// --------------------

interface MockProtocolReturn {
  data: { body: Record<string, unknown> } | undefined;
  isLoading: boolean;
  error: unknown;
}

const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => mockUseProtocol(),
}));

interface MockCompatibleReturn {
  data: { body: { macro: { id: string; name: string; language: string } }[] } | undefined;
}

const mockUseCompatibleMacros = vi.fn<() => MockCompatibleReturn>();
vi.mock("@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: () => mockUseCompatibleMacros(),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/util/date", () => ({
  formatDate: (d: string) => d,
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">{title}</div>
  ),
}));

vi.mock("@/components/json-code-viewer", () => ({
  JsonCodeViewer: ({ value }: { value: string; height?: string }) => (
    <pre data-testid="json-viewer">{value}</pre>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  CalendarIcon: ({ className }: { className?: string }) => (
    <span data-testid="calendar-icon" className={className} />
  ),
  CodeIcon: ({ className }: { className?: string }) => (
    <span data-testid="code-icon" className={className} />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span data-testid="external-link-icon" className={className} />
  ),
}));

vi.mock("@repo/ui/components", () => {
  const Card = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardHeader = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header">{children}</div>
  );
  const CardTitle = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  );
  const CardContent = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  );
  const RichTextRenderer = ({ content }: { content: string }) => (
    <div data-testid="rich-text">{content}</div>
  );
  return { Card, CardHeader, CardTitle, CardContent, RichTextRenderer };
});

// --------------------
// Tests
// --------------------
const mockProtocol = {
  name: "Water Quality Protocol",
  description: "Measures water quality parameters",
  family: "multispeq",
  code: '{"key":"value"}',
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-06-15T00:00:00Z",
  createdByName: "Dr. Smith",
};

describe("ProtocolOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseCompatibleMacros.mockReturnValue({ data: undefined });
  });

  it("should render loading state", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should render error state", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, message: "Server error" },
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("error-display")).toBeInTheDocument();
    expect(screen.getByText("errors.failedToLoadProtocol")).toBeInTheDocument();
  });

  it("should render not found state when no data", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("protocols.notFound")).toBeInTheDocument();
  });

  it("should render protocol details on success", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("Water Quality Protocol")).toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByTestId("rich-text")).toHaveTextContent(
      "Measures water quality parameters",
    );
    expect(screen.getByTestId("json-viewer")).toHaveTextContent('{"key":"value"}');
  });

  it("should render Ambit family correctly", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, family: "ambit" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("Ambit")).toBeInTheDocument();
  });

  it("should show compatible macros section when macros exist", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    mockUseCompatibleMacros.mockReturnValue({
      data: {
        body: [
          { macro: { id: "m1", name: "Temperature Plot", language: "python" } },
          { macro: { id: "m2", name: "Humidity Analysis", language: "r" } },
        ],
      },
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    expect(screen.getByText("r")).toBeInTheDocument();
  });

  it("should not show compatible macros section when empty", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    mockUseCompatibleMacros.mockReturnValue({
      data: { body: [] },
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.queryByText("protocolSettings.compatibleMacros")).not.toBeInTheDocument();
  });

  it("should show dash for missing createdByName", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdByName: null } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
