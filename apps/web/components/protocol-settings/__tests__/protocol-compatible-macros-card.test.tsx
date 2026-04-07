import { render, screen, userEvent } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useAddCompatibleMacro } from "../../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
// Import mocked hooks for test configuration
import { useProtocolCompatibleMacros } from "../../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useRemoveCompatibleMacro } from "../../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro";
import { tsr } from "../../../lib/tsr";
import { ProtocolCompatibleMacrosCard } from "../protocol-compatible-macros-card";

// --------------------
// Mocks
// --------------------

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
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
vi.mock("../../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: vi.fn(),
}));

vi.mock("../../../hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro", () => ({
  useAddCompatibleMacro: vi.fn(),
}));

vi.mock("../../../hooks/protocol/useRemoveCompatibleMacro/useRemoveCompatibleMacro", () => ({
  useRemoveCompatibleMacro: vi.fn(),
}));

vi.mock("../../../lib/tsr", () => ({
  tsr: {
    ReactQueryProvider: ({ children }: { children: React.ReactNode }) => children,
    macros: {
      listMacros: {
        useQuery: vi.fn(() => ({
          data: { body: [] },
          isLoading: false,
          error: null,
        })),
      },
    },
  },
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

    vi.spyOn(tsr.macros.listMacros, "useQuery").mockReturnValue({
      data: { body: mockAllMacros },
      isLoading: false,
      error: null,
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
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
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

  it("should call add mutation when a macro is added via the dropdown", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(lastDropdownProps).not.toBeNull();

    // Simulate adding a macro via the dropdown callback
    await lastDropdownProps?.onAddMacro("macro-3");

    expect(mockAddMacro).toHaveBeenCalledWith({
      params: { id: "proto-1" },
      body: { macroIds: ["macro-3"] },
    });
  });

  it("should pass isAdding state to MacroSearchWithDropdown", () => {
    vi.mocked(useAddCompatibleMacro).mockReturnValue({
      mutateAsync: mockAddMacro,
      isPending: true,
    } as never);

    render(<ProtocolCompatibleMacrosCard protocolId="proto-1" />);

    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.isAddingMacro).toBe(true);
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

  describe("embedded mode", () => {
    it("should render in embedded mode without Card wrapper", () => {
      render(<ProtocolCompatibleMacrosCard protocolId="proto-1" embedded />);

      expect(screen.queryByTestId("card")).not.toBeInTheDocument();
      expect(screen.queryByTestId("card-header")).not.toBeInTheDocument();
      expect(screen.queryByTestId("card-content")).not.toBeInTheDocument();
    });

    it("should render title and description in embedded mode", () => {
      render(<ProtocolCompatibleMacrosCard protocolId="proto-1" embedded />);

      expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
      expect(screen.getByText("protocolSettings.compatibleMacrosDescription")).toBeInTheDocument();
    });

    it("should render compatible macros list in embedded mode", () => {
      render(<ProtocolCompatibleMacrosCard protocolId="proto-1" embedded />);

      expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
      expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    });

    it("should render the macro search dropdown in embedded mode", () => {
      render(<ProtocolCompatibleMacrosCard protocolId="proto-1" embedded />);

      expect(screen.getByTestId("macro-dropdown")).toBeInTheDocument();
    });
  });
});
