import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useAddCompatibleProtocol } from "../../../hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol";
import { useMacroCompatibleProtocols } from "../../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useRemoveCompatibleProtocol } from "../../../hooks/macro/useRemoveCompatibleProtocol/useRemoveCompatibleProtocol";
import { useProtocolSearch } from "../../../hooks/protocol/useProtocolSearch/useProtocolSearch";
import { MacroCompatibleProtocolsCard } from "../macro-compatible-protocols-card";

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
  FileJson2: ({ className }: { className?: string }) => (
    <span data-testid="file-json2-icon" className={className} />
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

  const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  );

  return { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge };
});

// Mock hooks
vi.mock("../../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols", () => ({
  useMacroCompatibleProtocols: vi.fn(),
}));

vi.mock("../../../hooks/macro/useAddCompatibleProtocol/useAddCompatibleProtocol", () => ({
  useAddCompatibleProtocol: vi.fn(),
}));

vi.mock("../../../hooks/macro/useRemoveCompatibleProtocol/useRemoveCompatibleProtocol", () => ({
  useRemoveCompatibleProtocol: vi.fn(),
}));

vi.mock("../../../hooks/protocol/useProtocolSearch/useProtocolSearch", () => ({
  useProtocolSearch: vi.fn(() => ({ protocols: [] })),
}));

// Capture props passed to ProtocolSearchWithDropdown
interface DropdownPropsCaptured {
  availableProtocols: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void | Promise<void>;
  isAddingProtocol: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../protocol-search-with-dropdown", () => ({
  ProtocolSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="protocol-dropdown" />;
  },
}));

// --------------------
// Test data
// --------------------
const mockCompatibleProtocols = [
  { protocol: { id: "proto-1", name: "Temperature Protocol", family: "multispeq" } },
  { protocol: { id: "proto-2", name: "Humidity Protocol", family: "ambit" } },
];

const mockAllProtocols = [
  { id: "proto-1", name: "Temperature Protocol", family: "multispeq" },
  { id: "proto-2", name: "Humidity Protocol", family: "ambit" },
  { id: "proto-3", name: "Light Protocol", family: "multispeq" },
];

// --------------------
// Tests
// --------------------
describe("<MacroCompatibleProtocolsCard />", () => {
  const mockRemoveProtocol = vi.fn().mockResolvedValue(undefined);
  const mockAddProtocol = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    vi.mocked(useMacroCompatibleProtocols).mockReturnValue({
      data: { body: mockCompatibleProtocols },
      isLoading: false,
    } as never);

    vi.mocked(useAddCompatibleProtocol).mockReturnValue({
      mutateAsync: mockAddProtocol,
      isPending: false,
    } as never);

    vi.mocked(useRemoveCompatibleProtocol).mockReturnValue({
      mutateAsync: mockRemoveProtocol,
      isPending: false,
    } as never);

    vi.mocked(useProtocolSearch).mockReturnValue({
      protocols: mockAllProtocols,
    } as never);
  });

  it("should show loading state", () => {
    vi.mocked(useMacroCompatibleProtocols).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show 'no compatible protocols' when list is empty", () => {
    vi.mocked(useMacroCompatibleProtocols).mockReturnValue({
      data: { body: [] },
      isLoading: false,
    } as never);

    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(screen.getByText("macroSettings.noCompatibleProtocols")).toBeInTheDocument();
  });

  it("should render linked protocols with names and family", () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("Humidity Protocol")).toBeInTheDocument();
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("should render protocol links with correct hrefs", () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    const links = screen.getAllByRole("link");
    const proto1Links = links.filter((l) => l.getAttribute("href")?.includes("proto-1"));
    expect(proto1Links.length).toBeGreaterThan(0);
    expect(proto1Links[0]).toHaveAttribute("href", "/en-US/platform/protocols/proto-1");
  });

  it("should call remove mutation when X button is clicked", async () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    expect(mockRemoveProtocol).toHaveBeenCalledWith({
      params: { id: "macro-1", protocolId: "proto-1" },
    } as never);
  });

  it("should call remove mutation for specific protocol when its X button is clicked", async () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[1]);

    expect(mockRemoveProtocol).toHaveBeenCalledWith({
      params: { id: "macro-1", protocolId: "proto-2" },
    } as never);
  });

  it("should pass correct props to ProtocolSearchWithDropdown (filters out already-linked protocols)", () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(lastDropdownProps).not.toBeNull();
    // proto-1 and proto-2 are already linked, so only proto-3 should be available
    const availableIds = lastDropdownProps?.availableProtocols.map((p) => p.id);
    expect(availableIds).toContain("proto-3");
    expect(availableIds).not.toContain("proto-1");
    expect(availableIds).not.toContain("proto-2");
  });

  it("should render card title and description", () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(screen.getByText("macroSettings.compatibleProtocols")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.compatibleProtocolsDescription")).toBeInTheDocument();
  });

  it("should call add mutation when a protocol is added via the dropdown", async () => {
    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(lastDropdownProps).not.toBeNull();

    // Simulate adding a protocol via the dropdown callback
    await lastDropdownProps?.onAddProtocol("proto-3");

    expect(mockAddProtocol).toHaveBeenCalledWith({
      params: { id: "macro-1" },
      body: { protocolIds: ["proto-3"] },
    } as never);
  });

  it("should pass isAdding state to ProtocolSearchWithDropdown", () => {
    vi.mocked(useAddCompatibleProtocol).mockReturnValue({
      mutateAsync: mockAddProtocol,
      isPending: true,
    } as never);

    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.isAddingProtocol).toBe(true);
  });

  it("should disable remove buttons while removal is pending", () => {
    vi.mocked(useRemoveCompatibleProtocol).mockReturnValue({
      mutateAsync: mockRemoveProtocol,
      isPending: true,
    } as never);

    render(<MacroCompatibleProtocolsCard macroId="macro-1" />);

    const removeButtons = screen.getAllByRole("button");
    for (const btn of removeButtons) {
      expect(btn).toBeDisabled();
    }
  });
});
