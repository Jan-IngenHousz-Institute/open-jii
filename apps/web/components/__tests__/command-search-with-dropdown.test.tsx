import { createCommand } from "@/test/factories";
import { act, render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Command } from "@repo/api/schemas/command.schema";

import { CommandSearchWithDropdown } from "../command-search-with-dropdown";

// Mocks

interface PopoverPropsCaptured {
  availableCommands: Command[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddCommand: (id: string) => void | Promise<void>;
  isAddingCommand: boolean;
  loading?: boolean;
  setOpen: (v: boolean) => void;
}
let lastPopoverProps: PopoverPropsCaptured | null = null;

vi.mock("../command-search-popover", () => ({
  CommandSearchPopover: (props: PopoverPropsCaptured) => {
    lastPopoverProps = props;
    return (
      <div data-testid="command-popover">
        <span data-testid="dropdown-count">{props.availableCommands.length}</span>
      </div>
    );
  },
}));

// Test data & helpers
const commands: Command[] = [
  createCommand({ id: "p1" }),
  createCommand({ id: "p2" }),
  createCommand({ id: "p3" }),
];

function renderWidget(over: Partial<React.ComponentProps<typeof CommandSearchWithDropdown>> = {}) {
  const props: React.ComponentProps<typeof CommandSearchWithDropdown> = {
    availableCommands: commands,
    value: over.value ?? "",
    placeholder: "Pick a command",
    loading: false,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddCommand: vi.fn(),
    isAddingCommand: false,
    ...over,
  };
  lastPopoverProps = null;
  return {
    ...render(<CommandSearchWithDropdown {...props} />),
    props,
  };
}

// Tests
describe("<CommandSearchWithDropdown />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPopoverProps = null;
  });

  it("renders placeholder when no command is selected", () => {
    renderWidget({ value: "" });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Pick a command")).toBeInTheDocument();
  });

  it("filters dropdown list to exclude currently selected command", () => {
    renderWidget({ value: "p2" });
    expect(lastPopoverProps).not.toBeNull();
    const ids = lastPopoverProps?.availableCommands.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
    expect(ids).not.toContain("p2");
    expect(screen.getByTestId("dropdown-count")).toHaveTextContent("2");
  });

  it("forwards search callback and add callback to the popover", async () => {
    const onSearchChange = vi.fn();
    const onAddCommand = vi.fn();
    renderWidget({ value: "p1", onSearchChange, onAddCommand, searchValue: "abc" });

    const props = lastPopoverProps;
    expect(props?.searchValue).toBe("abc");

    props?.onSearchChange("new");
    expect(onSearchChange).toHaveBeenCalledWith("new");

    await Promise.resolve(props?.onAddCommand("p3"));
    expect(onAddCommand).toHaveBeenCalledWith("p3");
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

  it("passes loading and isAddingCommand flags straight through", () => {
    renderWidget({ value: "p1", loading: true, isAddingCommand: true });
    const props = lastPopoverProps;
    expect(props?.loading).toBe(true);
    expect(props?.isAddingCommand).toBe(true);
  });
});
