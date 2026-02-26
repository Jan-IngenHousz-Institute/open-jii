import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MeasurementPanel } from "../measurement-panel";

// Ensure React available globally for any dependencies expecting it
(globalThis as unknown as { React?: typeof React }).React = React;

// Debounce: allow toggling debounced state within tests
let debouncedFlag = false;
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number): [string, boolean] => [value, debouncedFlag],
}));

// Protocol search hook simulation
interface MockProtocol {
  id: string;
  name: string;
}
let mockProtocols: MockProtocol[] | undefined = [];
let mockIsLoading = false;
vi.mock("~/hooks/protocol/useProtocolSearch/useProtocolSearch", () => ({
  useProtocolSearch: (
    search: string,
  ): { protocols: MockProtocol[] | undefined; isLoading: boolean } => {
    const list = mockProtocols?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return { protocols: list, isLoading: mockIsLoading };
  },
}));

// Dropdown mock to capture props and emulate user interactions simply.
interface DropdownProps {
  availableProtocols: MockProtocol[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void;
  isAddingProtocol: boolean;
}
let lastDropdownProps: DropdownProps | null = null;
vi.mock("../../protocol-search-with-dropdown", () => ({
  ProtocolSearchWithDropdown: (props: DropdownProps) => {
    lastDropdownProps = props;
    const { availableProtocols, placeholder, searchValue, onSearchChange, onAddProtocol, loading } =
      props;
    return (
      <div>
        <input
          aria-label="protocol-search"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div data-testid="dropdown-state" data-loading={loading ? "true" : "false"} />
        <ul>
          {availableProtocols.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onAddProtocol(p.id)}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  },
}));

describe("<MeasurementPanel />", () => {
  beforeEach(() => {
    debouncedFlag = false;
    mockIsLoading = false;
    mockProtocols = [
      { id: "proto-1", name: "Protocol Alpha" },
      { id: "proto-2", name: "Protocol Beta" },
      { id: "humidity", name: "Humidity Sensor" },
    ];
    lastDropdownProps = null;
    vi.clearAllMocks();
  });

  const renderPanel = (overrides?: Partial<React.ComponentProps<typeof MeasurementPanel>>) => {
    const props: React.ComponentProps<typeof MeasurementPanel> = {
      selectedProtocolId: "",
      onChange: () => void 0,
      disabled: false,
      ...overrides,
    };
    return render(<MeasurementPanel {...props} />);
  };

  it("renders title, placeholder, and initial loading when not debounced", () => {
    renderPanel();
    expect(screen.getByText("experiments.measurementPanelTitle")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("experiments.searchProtocols")).toBeInTheDocument();
    const state = screen.getByTestId("dropdown-state");
    expect(state).toHaveAttribute("data-loading", "true");
  });

  it("clears loading after debounce when hook not loading", () => {
    const { rerender } = renderPanel();
    debouncedFlag = true;
    rerender(<MeasurementPanel selectedProtocolId="" onChange={() => void 0} disabled={false} />);
    const states = screen.getAllByTestId("dropdown-state");
    expect(states).toHaveLength(1);
    expect(states[0]).toHaveAttribute("data-loading", "false");
  });

  it("keeps loading true if protocol hook still fetching after debounce", () => {
    mockIsLoading = true;
    debouncedFlag = true;
    renderPanel();
    const state = screen.getByTestId("dropdown-state");
    expect(state).toHaveAttribute("data-loading", "true");
  });

  it("filters protocols via search and updates searchValue prop", async () => {
    renderPanel();
    const input = screen.getByLabelText("protocol-search");
    await userEvent.type(input, "hum");
    expect(lastDropdownProps?.searchValue).toBe("hum");
    expect(screen.getByRole("button", { name: "Humidity Sensor" })).toBeInTheDocument();
  });

  it("selects a protocol, fires onChange, and clears search", async () => {
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange });
    const target = screen.getByRole("button", { name: "Protocol Beta" });
    await userEvent.click(target);
    expect(onChange).toHaveBeenCalledWith("proto-2");
    expect(lastDropdownProps?.searchValue).toBe("");
  });

  it("does not emit onChange when disabled", async () => {
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange, disabled: true });
    const alphaBtn = screen.getByRole("button", { name: "Protocol Alpha" });
    await userEvent.click(alphaBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to empty protocol list when hook returns undefined", () => {
    mockProtocols = undefined;
    renderPanel();
    expect(lastDropdownProps?.availableProtocols.length).toBe(0);
  });
});
