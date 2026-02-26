import { createMacro } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Macro } from "@repo/api";
import { Popover } from "@repo/ui/components";

import { MacroSearchPopover } from "../macro-search-popover";

// --------------------
// Test data & helpers
// --------------------
const macros: Macro[] = [
  createMacro({ id: "m1" }),
  createMacro({ id: "m2", language: "r" }),
  createMacro({ id: "m3", language: "javascript", createdByName: undefined, sortOrder: 1 }),
];

function renderPopover(over: Partial<React.ComponentProps<typeof MacroSearchPopover>> = {}) {
  const props: React.ComponentProps<typeof MacroSearchPopover> = {
    availableMacros: macros,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddMacro: vi.fn(),
    isAddingMacro: false,
    loading: false,
    setOpen: vi.fn(),
    ...over,
  };
  return {
    ...render(
      <Popover open>
        <MacroSearchPopover {...props} />
      </Popover>,
    ),
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<MacroSearchPopover />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct structure", () => {
    renderPopover();

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("displays search input with correct placeholder", () => {
    renderPopover();

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "experiments.searchMacros");
  });

  it("renders all available macros as command items", () => {
    renderPopover();

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    // Check macro names
    expect(screen.getByText(macros[0].name)).toBeInTheDocument();
    expect(screen.getByText(macros[1].name)).toBeInTheDocument();
    expect(screen.getByText(macros[2].name)).toBeInTheDocument();

    // Check languages
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.getByText("r")).toBeInTheDocument();
    expect(screen.getByText("javascript")).toBeInTheDocument();
  });

  it("displays macro details correctly with created by info", () => {
    renderPopover();

    // m1 and m2 have createdByName ("Test User" from factory); m3 does not
    expect(screen.getAllByText("Test User")).toHaveLength(2);

    // Check that language labels are shown for all macros
    expect(screen.getAllByText("common.language")).toHaveLength(3);

    // Check that created by labels are shown for macros that have creator
    expect(screen.getAllByText("experiments.createdBy")).toHaveLength(2);
  });

  it("renders external links for all macros", () => {
    renderPopover();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", "/en-US/platform/macros/m1");
    expect(links[1]).toHaveAttribute("href", "/en-US/platform/macros/m2");
    expect(links[2]).toHaveAttribute("href", "/en-US/platform/macros/m3");

    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "experiments.seeMacroDetails");
      expect(link).toHaveAttribute("aria-label", "experiments.seeMacroDetails");
    });
  });

  it("calls onAddMacro when command item is clicked", async () => {
    const onAddMacro = vi.fn();
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddMacro, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await userEvent.click(items[0]);

    expect(onAddMacro).toHaveBeenCalledWith("m1");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles async onAddMacro correctly", async () => {
    const onAddMacro = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddMacro, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await userEvent.click(items[1]);

    await waitFor(() => {
      expect(onAddMacro).toHaveBeenCalledWith("m2");
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  it("disables command items when isAddingMacro is true", async () => {
    const onAddMacro = vi.fn();
    renderPopover({ isAddingMacro: true, onAddMacro });

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    // Clicking a disabled cmdk item does not trigger onSelect
    await userEvent.click(items[0]);
    expect(onAddMacro).not.toHaveBeenCalled();
  });

  it("shows loading state", () => {
    renderPopover({ loading: true, availableMacros: [] });

    expect(screen.getByText("experiments.searchingMacros")).toBeInTheDocument();
  });

  it("shows no macros found message when search has no results", () => {
    renderPopover({
      availableMacros: [],
      searchValue: "nonexistent",
      loading: false,
    });

    expect(screen.getByText("experiments.noMacrosFound")).toBeInTheDocument();
    expect(screen.getByText("experiments.tryDifferentSearchMacros")).toBeInTheDocument();
  });

  it("shows no macros available message when no search and no macros", () => {
    renderPopover({
      availableMacros: [],
      searchValue: "",
      loading: false,
    });

    expect(screen.getByText("experiments.noMacrosAvailable")).toBeInTheDocument();
    expect(screen.getByText("experiments.createFirstMacro")).toBeInTheDocument();
  });

  it("forwards search value and onSearchChange to input", async () => {
    const onSearchChange = vi.fn();
    renderPopover({ searchValue: "test", onSearchChange });

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("test");

    await userEvent.type(input, "x");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("uses custom popoverClassName when provided", () => {
    renderPopover({ popoverClassName: "w-96" });

    const combobox = screen.getByRole("combobox");
    const popoverContent = combobox.closest<HTMLElement>("[data-state]");
    expect(popoverContent).toHaveClass("w-96");
  });

  it("uses default popoverClassName when not provided", () => {
    renderPopover();

    const combobox = screen.getByRole("combobox");
    const popoverContent = combobox.closest<HTMLElement>("[data-state]");
    expect(popoverContent).toHaveClass("w-80");
  });

  it("sets correct data-value attributes on command items", () => {
    renderPopover();

    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("data-value", "m1");
    expect(items[1]).toHaveAttribute("data-value", "m2");
    expect(items[2]).toHaveAttribute("data-value", "m3");
  });

  it("calls onAddMacro when command item is clicked (basic functionality)", async () => {
    const onAddMacro = vi.fn();
    renderPopover({ onAddMacro });

    const items = screen.getAllByRole("option");
    await userEvent.click(items[0]);

    expect(onAddMacro).toHaveBeenCalledWith("m1");
  });

  it("renders preferred badge for macros with sortOrder", () => {
    renderPopover();

    const badge = screen.getByText("common.preferred");
    expect(badge).toBeInTheDocument();
  });
});
