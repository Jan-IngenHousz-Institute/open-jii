import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { render, screen } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnalysisPanel } from "../analysis-panel";

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

  return { Card, CardHeader, CardTitle, CardContent };
});

// Mock tsr (used directly by AnalysisPanel for macro search)
const mockMacros = [
  { id: "macro-1", name: "Temperature Plot", language: "python", createdByName: "Alice" },
  { id: "macro-2", name: "Humidity Analysis", language: "r", createdByName: "Bob" },
  { id: "macro-3", name: "Statistical Summary", language: "javascript", createdByName: "Charlie" },
];

vi.mock("../../../lib/tsr", () => ({
  tsr: {
    ReactQueryProvider: ({ children }: { children: React.ReactNode }) => children,
    macros: {
      listMacros: {
        useQuery: vi.fn(() => ({
          data: { body: mockMacros },
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

// Mock useProtocol (used by AnalysisPanel to fetch upstream protocol name)
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => ({ data: undefined }),
}));

// Mock useProtocolCompatibleMacros
vi.mock("@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: vi.fn(),
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
  disabled?: boolean;
  recommendedMacroIds?: Set<string>;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="macro-dropdown" />;
  },
}));

// --------------------
// Tests
// --------------------
describe("<AnalysisPanel /> protocol-macro compatibility", () => {
  const defaultOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    // Default: no upstream protocol / no compatibility data
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);
  });

  it("should render without upstreamProtocolId (no warning, no recommended badges)", () => {
    render(<AnalysisPanel selectedMacroId="macro-1" onChange={defaultOnChange} />);

    // No incompatibility warning should be present
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();

    // No recommended macro IDs should be passed
    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should show incompatibility warning when selected macro is not compatible", () => {
    // Protocol has compatible macros macro-1 and macro-2, but macro-3 is selected
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: {
        body: [
          { macro: { id: "macro-1", name: "Temperature Plot", language: "python" } },
          { macro: { id: "macro-2", name: "Humidity Analysis", language: "r" } },
        ],
      },
    } as never);

    render(
      <AnalysisPanel
        selectedMacroId="macro-3"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    expect(screen.getByText("experiments.macroIncompatibilityWarning")).toBeInTheDocument();
  });

  it("should NOT show warning when selected macro IS compatible", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: {
        body: [
          { macro: { id: "macro-1", name: "Temperature Plot", language: "python" } },
          { macro: { id: "macro-2", name: "Humidity Analysis", language: "r" } },
        ],
      },
    } as never);

    render(
      <AnalysisPanel
        selectedMacroId="macro-1"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when no compatibility data (no upstream protocol)", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);

    render(<AnalysisPanel selectedMacroId="macro-3" onChange={defaultOnChange} />);

    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when compatible macros list is empty", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: { body: [] },
    } as never);

    render(
      <AnalysisPanel
        selectedMacroId="macro-3"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when no macro is selected", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: {
        body: [{ macro: { id: "macro-1", name: "Temperature Plot", language: "python" } }],
      },
    } as never);

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should pass recommendedMacroIds to MacroSearchWithDropdown when compatibility data exists", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: {
        body: [
          { macro: { id: "macro-1", name: "Temperature Plot", language: "python" } },
          { macro: { id: "macro-2", name: "Humidity Analysis", language: "r" } },
        ],
      },
    } as never);

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.recommendedMacroIds).toBeDefined();
    expect(lastDropdownProps?.recommendedMacroIds).toBeInstanceOf(Set);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-1")).toBe(true);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-2")).toBe(true);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-3")).toBe(false);
  });

  it("should not pass recommendedMacroIds when no upstream protocol", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);

    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} />);

    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should not pass recommendedMacroIds when compatible macros list is empty", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: { body: [] },
    } as never);

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    expect(lastDropdownProps).not.toBeNull();
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should call useProtocolCompatibleMacros with upstreamProtocolId and enabled=true", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    expect(useProtocolCompatibleMacros).toHaveBeenCalledWith("proto-1", true);
  });

  it("should sort compatible macros first in the dropdown list", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: {
        body: [{ macro: { id: "macro-3", name: "Statistical Summary", language: "javascript" } }],
      },
    } as never);

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    expect(lastDropdownProps).not.toBeNull();
    const macroIds = lastDropdownProps?.availableMacros.map((m) => m.id);
    // macro-3 is compatible, so it should be sorted first
    expect(macroIds?.[0]).toBe("macro-3");
  });

  it("should call useProtocolCompatibleMacros with empty string and enabled=false when no upstreamProtocolId", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);

    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} />);

    expect(useProtocolCompatibleMacros).toHaveBeenCalledWith("", false);
  });

  it("should not call onChange when disabled and macro is added via dropdown", () => {
    vi.mocked(useProtocolCompatibleMacros).mockReturnValue({
      data: undefined,
    } as never);

    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} disabled />);

    expect(lastDropdownProps).not.toBeNull();
    void lastDropdownProps?.onAddMacro("macro-1");

    expect(defaultOnChange).not.toHaveBeenCalled();
  });
});
