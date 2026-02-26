import { createProtocol } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Popover } from "@repo/ui/components";

import { ProtocolSearchPopover } from "./protocol-search-popover";

// --------------------
// Test data & helpers
// --------------------
const protocols = [
  createProtocol({ name: "Fv/FM Baseline", family: "multispeq", createdByName: "Ada Lovelace" }),
  createProtocol({ name: "Ambient Light", family: "ambit", createdByName: "Al Turing" }),
  createProtocol({ name: "PAM Fluorometry", family: "multispeq", sortOrder: 1 }),
];

function renderPopover(over: Partial<React.ComponentProps<typeof ProtocolSearchPopover>> = {}) {
  const user = userEvent.setup();
  const props: React.ComponentProps<typeof ProtocolSearchPopover> = {
    availableProtocols: protocols,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddProtocol: vi.fn(),
    isAddingProtocol: false,
    loading: false,
    setOpen: vi.fn(),
    ...over,
  };
  return {
    ...render(
      <Popover open>
        <ProtocolSearchPopover {...props} />
      </Popover>,
    ),
    user,
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<ProtocolSearchPopover />", () => {
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
    expect(input).toHaveAttribute("placeholder", "experiments.searchProtocols");
  });

  it("renders all available protocols as command items", () => {
    renderPopover();

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    // Check protocol names
    expect(screen.getByText("Fv/FM Baseline")).toBeInTheDocument();
    expect(screen.getByText("Ambient Light")).toBeInTheDocument();
    expect(screen.getByText("PAM Fluorometry")).toBeInTheDocument();

    // Check families
    expect(screen.getAllByText("multispeq")).toHaveLength(2);
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("displays protocol details correctly with created by info", () => {
    renderPopover();

    // Check that created by info is shown for protocols that have it
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Al Turing")).toBeInTheDocument();

    // Check that family labels are shown
    const familyLabels = screen.getAllByText("experiments.family");
    expect(familyLabels).toHaveLength(3);

    // Check that created by labels are shown for protocols that have creator
    const createdByLabels = screen.getAllByText("experiments.createdBy");
    expect(createdByLabels).toHaveLength(2); // Only p1 and p2 have createdByName
  });

  it("renders external links for all protocols", () => {
    renderPopover();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", `/en-US/platform/protocols/${protocols[0].id}`);
    expect(links[1]).toHaveAttribute("href", `/en-US/platform/protocols/${protocols[1].id}`);
    expect(links[2]).toHaveAttribute("href", `/en-US/platform/protocols/${protocols[2].id}`);

    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "experiments.seeProtocolDetails");
      expect(link).toHaveAttribute("aria-label", "experiments.seeProtocolDetails");
    });
  });

  it("calls onAddProtocol when command item is clicked", async () => {
    const onAddProtocol = vi.fn();
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ onAddProtocol, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await user.click(items[0]);

    expect(onAddProtocol).toHaveBeenCalledWith(protocols[0].id);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles async onAddProtocol correctly", async () => {
    const onAddProtocol = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ onAddProtocol, setOpen, onSearchChange });

    const items = screen.getAllByRole("option");
    await user.click(items[1]);

    await waitFor(() => {
      expect(onAddProtocol).toHaveBeenCalledWith(protocols[1].id);
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  it("disables command items when isAddingProtocol is true", async () => {
    const onAddProtocol = vi.fn();
    const { user } = renderPopover({ isAddingProtocol: true, onAddProtocol });

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);

    // Clicking a disabled cmdk item does not trigger onSelect
    await user.click(items[0]);
    expect(onAddProtocol).not.toHaveBeenCalled();
  });

  it("shows loading state", () => {
    renderPopover({ loading: true, availableProtocols: [] });

    expect(screen.getByText("experiments.searchingProtocols")).toBeInTheDocument();
  });

  it("shows no protocols found message when search has no results", () => {
    renderPopover({
      availableProtocols: [],
      searchValue: "nonexistent",
      loading: false,
    });

    expect(screen.getByText("experiments.noProtocolsFound")).toBeInTheDocument();
    expect(screen.getByText("experiments.tryDifferentSearchProtocols")).toBeInTheDocument();
  });

  it("shows no protocols available message when no search and no protocols", () => {
    renderPopover({
      availableProtocols: [],
      searchValue: "",
      loading: false,
    });

    expect(screen.getByText("experiments.noProtocolsAvailable")).toBeInTheDocument();
    expect(screen.getByText("experiments.createFirstProtocol")).toBeInTheDocument();
  });

  it("forwards search value and onSearchChange to input", async () => {
    const onSearchChange = vi.fn();
    const { user } = renderPopover({ searchValue: "test", onSearchChange });

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("test");

    await user.type(input, "x");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("renders preferred badge for protocols with sortOrder", () => {
    renderPopover();

    const badge = screen.getByText("common.preferred");
    expect(badge).toBeInTheDocument();
  });
});
