import { createProtocol } from "@/test/factories";
import { act, render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Protocol } from "@repo/api";

import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

// Mocks

interface PopoverPropsCaptured {
  availableProtocols: Protocol[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void | Promise<void>;
  isAddingProtocol: boolean;
  loading?: boolean;
  setOpen: (v: boolean) => void;
}
let lastPopoverProps: PopoverPropsCaptured | null = null;

vi.mock("../protocol-search-popover", () => ({
  ProtocolSearchPopover: (props: PopoverPropsCaptured) => {
    lastPopoverProps = props;
    return (
      <div data-testid="protocol-popover">
        <span data-testid="dropdown-count">{props.availableProtocols.length}</span>
      </div>
    );
  },
}));

// Test data & helpers
const protocols: Protocol[] = [
  createProtocol({ id: "p1" }),
  createProtocol({ id: "p2" }),
  createProtocol({ id: "p3" }),
];

function renderWidget(over: Partial<React.ComponentProps<typeof ProtocolSearchWithDropdown>> = {}) {
  const props: React.ComponentProps<typeof ProtocolSearchWithDropdown> = {
    availableProtocols: protocols,
    value: over.value ?? "",
    placeholder: "Pick a protocol",
    loading: false,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddProtocol: vi.fn(),
    isAddingProtocol: false,
    ...over,
  };
  lastPopoverProps = null;
  return {
    ...render(<ProtocolSearchWithDropdown {...props} />),
    props,
  };
}

// Tests
describe("<ProtocolSearchWithDropdown />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPopoverProps = null;
  });

  it("renders placeholder when no protocol is selected", () => {
    renderWidget({ value: "" });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Pick a protocol")).toBeInTheDocument();
  });

  it("filters dropdown list to exclude currently selected protocol", () => {
    renderWidget({ value: "p2" });
    expect(lastPopoverProps).not.toBeNull();
    const ids = lastPopoverProps?.availableProtocols.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
    expect(ids).not.toContain("p2");
    expect(screen.getByTestId("dropdown-count")).toHaveTextContent("2");
  });

  it("forwards search callback and add callback to the popover", async () => {
    const onSearchChange = vi.fn();
    const onAddProtocol = vi.fn();
    renderWidget({ value: "p1", onSearchChange, onAddProtocol, searchValue: "abc" });

    const props = lastPopoverProps;
    expect(props?.searchValue).toBe("abc");

    props?.onSearchChange("new");
    expect(onSearchChange).toHaveBeenCalledWith("new");

    await Promise.resolve(props?.onAddProtocol("p3"));
    expect(onAddProtocol).toHaveBeenCalledWith("p3");
  });

  it("exposes setOpen via child and updates aria-expanded when invoked", () => {
    renderWidget({ value: "p1" });

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    act(() => {
      lastPopoverProps?.setOpen(true);
    });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");

    act(() => {
      lastPopoverProps?.setOpen(false);
    });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });

  it("passes loading and isAddingProtocol flags straight through", () => {
    renderWidget({ value: "p1", loading: true, isAddingProtocol: true });
    const props = lastPopoverProps;
    expect(props?.loading).toBe(true);
    expect(props?.isAddingProtocol).toBe(true);
  });
});
