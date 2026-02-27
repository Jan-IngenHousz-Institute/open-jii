import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useMacros } from "../../../hooks/macro/useMacros/useMacros";
import { useAddCompatibleMacro } from "../../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
// Import mocked hooks for test configuration
import { useProtocolCompatibleMacros } from "../../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useRemoveCompatibleMacro } from "../../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro";
import { ProtocolCompatibleMacrosCard } from "../protocol-compatible-macros-card";

// Keep React on global for JSX in mocks
globalThis.React = React;

// --------------------
// Mocks
// --------------------

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

vi.mock("lucide-react", () => ({
  X: ({ className }: { className?: string }) => <span data-testid="x-icon" className={className} />,
  ExternalLink: ({ className }: { className?: string }) => (
    <span data-testid="external-link-icon" className={className} />
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

vi.mock("@repo/ui/components", () => {
  const Card = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardHeader = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header">{children}</div>
  );
  const CardTitle = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <h3 data-testid="card-title">{children}</h3>
  );
  const CardDescription = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <p data-testid="card-description">{children}</p>
  );
  const CardContent = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  );
  const Button = ({
    children,
    onClick,
    disabled,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );

  return { Card, CardHeader, CardTitle, CardDescription, CardContent, Button };
});

// Mock hooks
vi.mock("../../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: vi.fn(),
}));

vi.mock("../../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro", () => ({
  useAddCompatibleMacro: vi.fn(),
}));

vi.mock("../../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro", () => ({
  useRemoveCompatibleMacro: vi.fn(),
}));

vi.mock("../../../hooks/macro/useMacros/useMacros", () => ({
  useMacros: vi.fn(() => ({ data: [] })),
}));

// Capture props passed to MacroSearchWithDropdown
interface DropdownPropsCaptured {
  availableMacros: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddMacro: (id: string) => void | Promise<void>;
  isAddingMacro: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="macro-dropdown" />;
  },
}));

// --------------------
// Test data
// --------------------
const mockCompatibleMacros = [
  { macro: { id: "macro-1", name: "Temperature Plot", language: "python" } },
  { macro: { id: "macro-2", name: "Humidity Analysis", language: "r" } },
];

const mockAllMacros = [
  { id: "macro-1", name: "Temperature Plot", language: "python" },
  { id: "macro-2", name: "Humidity Analysis", language: "r" },
  { id: "macro-3", name: "Statistical Summary", language: "javascript" },
];

// --------------------
// Tests
// --------------------
describe("<ProtocolCompatibleMacrosCard />", () => {
  const mockRemoveMacro = vi.fn().mockResolvedValue(undefined);
  const mockAddMacro = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: { body: mockCompatibleMacros },
      isLoading: false,
    } as never);

    vi.mocked(useAddCompatibleMacro).mockReturnValue({
      mutateAsync: mockAddMacro,
      isPending: false,
    } as never);

    vi.mocked(useRemoveCompatibleMacro).mockReturnValue({
      mutateAsync: mockRemoveMacro,
      isPending: false,
    } as never);

    vi.mocked(useMacros).mockReturnValue({
      data: mockAllMacros,
    } as never);
  });

  it("should show loading state", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show 'no compatible macros' when list is empty", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: { body: [] },
      isLoading: false,
    } as never);

    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
  });

  it("should render linked macros with names and language", () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    expect(screen.getByText("r")).toBeInTheDocument();
  });

  it("should render macro links with correct hrefs", () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    const links = screen.getAllByRole("link");
    const macro1Links = links.filter((l) => l.getAttribute("href")?.includes("macro-1"));
    expect(macro1Links.length).toBeGreaterThan(0);
    expect(macro1Links[0]).toHaveAttribute("href", "/en-US/platform/macros/macro-1");
  });

  it("should call remove mutation when X button is clicked", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    // Each macro row has a remove button containing the X icon
    const removeButtons = screen.getAllByRole("button");
    // Click the first remove button (for macro-1)
    await userEvent.click(removeButtons[0]);

    expect(mockRemoveMacro).toHaveBeenCalledWith({
      params: { id: "proto-1", macroId: "macro-1" },
    });
  });

  it("should call remove mutation for specific macro when its X button is clicked", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    const removeButtons = screen.getAllByRole("button");
    // Click the second remove button (for macro-2)
    await userEvent.click(removeButtons[1]);

    expect(mockRemoveMacro).toHaveBeenCalledWith({
      params: { id: "proto-1", macroId: "macro-2" },
    });
  });

  it("should pass correct props to MacroSearchWithDropdown (filters out already-linked macros)", () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(lastDropdownProps).not.toBeNull();
    // macro-1 and macro-2 are already linked, so only macro-3 should be available
    const availableIds = lastDropdownProps?.availableMacros.map((m) => m.id);
    expect(availableIds).toContain("macro-3");
    expect(availableIds).not.toContain("macro-1");
    expect(availableIds).not.toContain("macro-2");
  });

  it("should render card title and description", () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.compatibleMacrosDescription")).toBeInTheDocument();
  });

  it("should disable remove buttons while removal is pending", () => {
    vi.mocked(useRemoveCompatibleMacro).mockReturnValue({
      mutateAsync: mockRemoveMacro,
      isPending: true,
    } as never);

    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    const removeButtons = screen.getAllByRole("button");
    for (const btn of removeButtons) {
      expect(btn).toBeDisabled();
    }
  });
});
