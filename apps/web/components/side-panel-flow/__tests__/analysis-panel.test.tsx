import { createMacro, createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { AnalysisPanel } from "../analysis-panel";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

const mockMacros = [
  createMacro({ id: "macro-1", name: "Temperature Plot", language: "python" }),
  createMacro({ id: "macro-2", name: "Humidity Analysis", language: "r" }),
  createMacro({ id: "macro-3", name: "Statistical Summary", language: "javascript" }),
];

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

describe("<AnalysisPanel /> protocol-macro compatibility", () => {
  const defaultOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    server.mount(contract.macros.listMacros, { body: mockMacros });
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "proto-1", name: "Upstream Protocol" }),
    });
    // Don't mount listCompatibleMacros by default — most tests override it
  });

  it("should render without upstreamProtocolId (no warning, no recommended badges)", async () => {
    render(<AnalysisPanel selectedMacroId="macro-1" onChange={defaultOnChange} />);

    // No incompatibility warning should be present
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();

    // No recommended macro IDs should be passed
    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should show incompatibility warning when selected macro is not compatible", async () => {
    // Protocol has compatible macros macro-1 and macro-2, but macro-3 is selected
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-1",
            name: "Temperature Plot",
            filename: "temp.py",
            language: "python" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-2",
            name: "Humidity Analysis",
            filename: "humid.r",
            language: "r" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <AnalysisPanel
        selectedMacroId="macro-3"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("experiments.macroIncompatibilityWarning")).toBeInTheDocument(),
    );
  });

  it("should NOT show warning when selected macro IS compatible", async () => {
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-1",
            name: "Temperature Plot",
            filename: "temp.py",
            language: "python" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-2",
            name: "Humidity Analysis",
            filename: "humid.r",
            language: "r" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <AnalysisPanel
        selectedMacroId="macro-1"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when no compatibility data (no upstream protocol)", async () => {
    render(<AnalysisPanel selectedMacroId="macro-3" onChange={defaultOnChange} />);

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when compatible macros list is empty", async () => {
    server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    render(
      <AnalysisPanel
        selectedMacroId="macro-3"
        onChange={defaultOnChange}
        upstreamProtocolId="proto-1"
      />,
    );

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should NOT show warning when no macro is selected", async () => {
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-1",
            name: "Temperature Plot",
            filename: "temp.py",
            language: "python" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(screen.queryByText("experiments.macroIncompatibilityWarning")).not.toBeInTheDocument();
  });

  it("should pass recommendedMacroIds to MacroSearchWithDropdown when compatibility data exists", async () => {
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-1",
            name: "Temperature Plot",
            filename: "temp.py",
            language: "python" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-2",
            name: "Humidity Analysis",
            filename: "humid.r",
            language: "r" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      expect(lastDropdownProps?.recommendedMacroIds).toBeDefined();
    });
    expect(lastDropdownProps?.recommendedMacroIds).toBeInstanceOf(Set);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-1")).toBe(true);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-2")).toBe(true);
    expect(lastDropdownProps?.recommendedMacroIds?.has("macro-3")).toBe(false);
  });

  it("should not pass recommendedMacroIds when no upstream protocol", async () => {
    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} />);

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should not pass recommendedMacroIds when compatible macros list is empty", async () => {
    server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(lastDropdownProps?.recommendedMacroIds).toBeUndefined();
  });

  it("should call useProtocolCompatibleMacros with upstreamProtocolId and enabled=true", async () => {
    const compatSpy = server.mount(contract.protocols.listCompatibleMacros, {
      body: [],
    });

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    await waitFor(() => expect(compatSpy.called).toBe(true));
    expect(compatSpy.params.id).toBe("proto-1");
  });

  it("should sort compatible macros first in the dropdown list", async () => {
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "proto-1",
          macro: {
            id: "macro-3",
            name: "Statistical Summary",
            filename: "stat.js",
            language: "javascript" as const,
            createdBy: "user-1",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <AnalysisPanel selectedMacroId="" onChange={defaultOnChange} upstreamProtocolId="proto-1" />,
    );

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      const macroIds = lastDropdownProps?.availableMacros.map((m) => m.id);
      // macro-3 is compatible, so it should be sorted first
      expect(macroIds?.[0]).toBe("macro-3");
    });
  });

  it("should call useProtocolCompatibleMacros with empty string and enabled=false when no upstreamProtocolId", async () => {
    const compatSpy = server.mount(contract.protocols.listCompatibleMacros, {
      body: [],
    });

    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} />);

    // Without upstreamProtocolId, the hook is called with enabled=false, so no request is made
    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    expect(compatSpy.called).toBe(false);
  });

  it("should not call onChange when disabled and macro is added via dropdown", async () => {
    render(<AnalysisPanel selectedMacroId="" onChange={defaultOnChange} disabled />);

    await waitFor(() => expect(lastDropdownProps).not.toBeNull());
    void lastDropdownProps?.onAddMacro("macro-1");

    expect(defaultOnChange).not.toHaveBeenCalled();
  });
});
