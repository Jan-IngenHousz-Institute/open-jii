import { createCommand } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Popover } from "@repo/ui/components/popover";

import { CommandSearchPopover } from "./command-search-popover";

// Test data & helpers
const commands = [
  createCommand({ name: "Fv/FM Baseline", family: "multispeq", createdByName: "Ada Lovelace" }),
  createCommand({ name: "Ambient Light", family: "ambyte", createdByName: "Al Turing" }),
  createCommand({
    name: "PAM Fluorometry",
    family: "multispeq",
    sortOrder: 1,
    createdByName: undefined,
  }),
];

function renderPopover(over: Partial<React.ComponentProps<typeof CommandSearchPopover>> = {}) {
  const user = userEvent.setup();
  const props: React.ComponentProps<typeof CommandSearchPopover> = {
    availableCommands: commands,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddCommand: vi.fn(),
    isAddingCommand: false,
    loading: false,
    setOpen: vi.fn(),
    ...over,
  };
  return {
    ...render(
      <Popover open>
        <CommandSearchPopover {...props} />
      </Popover>,
    ),
    user,
    props,
  };
}

// Tests
describe("<CommandSearchPopover />", () => {
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
    expect(input).toHaveAttribute("placeholder", "experiments.searchCommands");
  });

  it("renders all available commands as command items", () => {
    renderPopover();

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    expect(screen.getByText("Fv/FM Baseline")).toBeInTheDocument();
    expect(screen.getByText("Ambient Light")).toBeInTheDocument();
    expect(screen.getByText("PAM Fluorometry")).toBeInTheDocument();

    expect(screen.getAllByText("multispeq")).toHaveLength(2);
    expect(screen.getByText("ambyte")).toBeInTheDocument();
  });

  it("displays command details correctly with created by info", () => {
    renderPopover();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Al Turing")).toBeInTheDocument();

    const familyLabels = screen.getAllByText("experiments.family");
    expect(familyLabels).toHaveLength(3);

    const createdByLabels = screen.getAllByText("experiments.createdBy");
    expect(createdByLabels).toHaveLength(2); // Only p1 and p2 have createdByName
  });

  it("renders external links for all commands", () => {
    renderPopover();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", `/en-US/platform/commands/${commands[0].id}`);
    expect(links[1]).toHaveAttribute("href", `/en-US/platform/commands/${commands[1].id}`);
    expect(links[2]).toHaveAttribute("href", `/en-US/platform/commands/${commands[2].id}`);

    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "experiments.seeCommandDetails");
      expect(link).toHaveAttribute("aria-label", "experiments.seeCommandDetails");
    });
  });

  it("calls onAddCommand when command item is clicked", async () => {
    const onAddCommand = vi.fn();
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ onAddCommand, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await user.click(items[0]);

    expect(onAddCommand).toHaveBeenCalledWith(commands[0].id);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles async onAddCommand correctly", async () => {
    const onAddCommand = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ onAddCommand, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await user.click(items[1]);

    await waitFor(() => {
      expect(onAddCommand).toHaveBeenCalledWith(commands[1].id);
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  it("disables command items when isAddingCommand is true", async () => {
    const onAddCommand = vi.fn();
    const { user } = renderPopover({ isAddingCommand: true, onAddCommand });

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    // Clicking a disabled cmdk item does not trigger onSelect
    await user.click(items[0]);
    expect(onAddCommand).not.toHaveBeenCalled();
  });

  it("shows loading state", () => {
    renderPopover({ loading: true, availableCommands: [] });

    expect(screen.getByText("experiments.searchingCommands")).toBeInTheDocument();
  });

  it("shows no commands found message when search has no results", () => {
    renderPopover({
      availableCommands: [],
      searchValue: "nonexistent",
      loading: false,
    });

    expect(screen.getByText("experiments.noCommandsFound")).toBeInTheDocument();
    expect(screen.getByText("experiments.tryDifferentSearchCommands")).toBeInTheDocument();
  });

  it("shows no commands available message when no search and no commands", () => {
    renderPopover({
      availableCommands: [],
      searchValue: "",
      loading: false,
    });

    expect(screen.getByText("experiments.noCommandsAvailable")).toBeInTheDocument();
    expect(screen.getByText("experiments.createFirstCommand")).toBeInTheDocument();
  });

  it("forwards search value and onSearchChange to input", async () => {
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ searchValue: "test", onSearchChange });

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("test");

    await user.type(input, "x");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("renders preferred badge for commands with sortOrder", () => {
    renderPopover();

    const badge = screen.getByText("common.preferred");
    expect(badge).toBeInTheDocument();
  });
});
