import { createMacro } from "@/test/factories";
import { act, render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Macro } from "@repo/api";

import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

// Mocks

interface PopoverPropsCaptured {
  availableMacros: Macro[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddMacro: (id: string) => void | Promise<void>;
  isAddingMacro: boolean;
  loading?: boolean;
  setOpen: (v: boolean) => void;
  popoverClassName?: string;
}
let lastPopoverProps: PopoverPropsCaptured | null = null;

vi.mock("../macro-search-popover", () => ({
  MacroSearchPopover: (props: PopoverPropsCaptured) => {
    lastPopoverProps = props;
    return (
      <div data-testid="macro-popover">
        <span data-testid="dropdown-count">{props.availableMacros.length}</span>
      </div>
    );
  },
}));

// Test data & helpers
const macros: Macro[] = [
  createMacro({ id: "m1" }),
  createMacro({ id: "m2" }),
  createMacro({ id: "m3" }),
];

function renderWidget(over: Partial<React.ComponentProps<typeof MacroSearchWithDropdown>> = {}) {
  const props: React.ComponentProps<typeof MacroSearchWithDropdown> = {
    availableMacros: macros,
    value: over.value ?? "",
    placeholder: "experiments.pickMacro",
    loading: false,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddMacro: vi.fn(),
    isAddingMacro: false,
    ...over,
  };
  lastPopoverProps = null;
  return {
    ...render(<MacroSearchWithDropdown {...props} />),
    props,
  };
}

// Tests
describe("<MacroSearchWithDropdown />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPopoverProps = null;
  });

  it("renders placeholder when no macro is selected", () => {
    renderWidget({ value: "" });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("experiments.pickMacro")).toBeInTheDocument();
  });

  it("renders default placeholder when no custom placeholder and no macro is selected", () => {
    renderWidget({ value: "", placeholder: undefined });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("experiments.searchMacros")).toBeInTheDocument();
  });

  it("filters dropdown list to exclude currently selected macro", () => {
    renderWidget({ value: "m2" });
    expect(lastPopoverProps).not.toBeNull();
    const ids = lastPopoverProps?.availableMacros.map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m3");
    expect(ids).not.toContain("m2");
    expect(screen.getByTestId("dropdown-count")).toHaveTextContent("2");
  });

  it("forwards search callback and add callback to the popover", async () => {
    const onSearchChange = vi.fn();
    const onAddMacro = vi.fn();
    renderWidget({ value: "m1", onSearchChange, onAddMacro, searchValue: "abc" });

    const props = lastPopoverProps;
    expect(props?.searchValue).toBe("abc");

    props?.onSearchChange("new");
    expect(onSearchChange).toHaveBeenCalledWith("new");

    await Promise.resolve(props?.onAddMacro("m3"));
    expect(onAddMacro).toHaveBeenCalledWith("m3");
  });

  it("exposes setOpen via child and updates aria-expanded when invoked", () => {
    renderWidget({ value: "m1" });

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

  it("passes loading and isAddingMacro flags straight through", () => {
    renderWidget({ value: "m1", loading: true, isAddingMacro: true });
    const props = lastPopoverProps;
    expect(props?.loading).toBe(true);
    expect(props?.isAddingMacro).toBe(true);
  });

  it("respects disabled state", () => {
    renderWidget({ value: "m1", disabled: true });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });

  it("passes correct popoverClassName to MacroSearchPopover", () => {
    renderWidget({ value: "m1" });
    const props = lastPopoverProps;
    expect(props?.popoverClassName).toBe("w-[var(--radix-popover-trigger-width)]");
  });
});
