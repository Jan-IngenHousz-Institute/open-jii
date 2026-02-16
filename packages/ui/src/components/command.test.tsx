import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./command";

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

describe("Command", () => {
  describe("Command (Root)", () => {
    it("renders command component with children", () => {
      render(
        <Command data-testid="command">
          <div>Test Content</div>
        </Command>,
      );

      const command = screen.getByTestId("command");
      expect(command).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("applies default classes", () => {
      render(<Command data-testid="command">Content</Command>);

      const command = screen.getByTestId("command");
      expect(command.className).toContain("bg-popover");
      expect(command.className).toContain("text-popover-foreground");
    });

    it("applies custom className", () => {
      render(
        <Command className="custom-class" data-testid="command">
          Content
        </Command>,
      );

      const command = screen.getByTestId("command");
      expect(command).toHaveClass("custom-class");
    });
  });

  describe("CommandDialog", () => {
    it("renders dialog with command inside when open", () => {
      render(
        <CommandDialog open>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandItem>Item 1</CommandItem>
          </CommandList>
        </CommandDialog>,
      );

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });

    it("does not render content when closed", () => {
      render(
        <CommandDialog open={false}>
          <CommandInput placeholder="Search..." />
        </CommandDialog>,
      );

      expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
    });
  });

  describe("CommandInput", () => {
    it("renders input with placeholder", () => {
      render(
        <Command>
          <CommandInput placeholder="Type a command..." />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Type a command...");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("placeholder", "Type a command...");
    });

    it("renders search icon", () => {
      const { container } = render(
        <Command>
          <CommandInput />
        </Command>,
      );

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Command>
          <CommandInput className="custom-input" placeholder="Search" />
        </Command>,
      );

      const input = screen.getByPlaceholderText("Search");
      expect(input.className).toContain("custom-input");
    });
  });

  describe("CommandList", () => {
    it("renders list with children", () => {
      render(
        <Command>
          <CommandList data-testid="command-list">
            <CommandItem>Item 1</CommandItem>
            <CommandItem>Item 2</CommandItem>
          </CommandList>
        </Command>,
      );

      const list = screen.getByTestId("command-list");
      expect(list).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("applies overflow classes", () => {
      render(
        <Command>
          <CommandList data-testid="list">
            <CommandItem>Item</CommandItem>
          </CommandList>
        </Command>,
      );

      const list = screen.getByTestId("list");
      expect(list.className).toContain("overflow-y-auto");
      expect(list.className).toContain("overflow-x-hidden");
    });
  });

  describe("CommandEmpty", () => {
    it("renders empty state message", () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("No results found.")).toBeInTheDocument();
    });

    it("applies center text class", () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty data-testid="empty">No results</CommandEmpty>
          </CommandList>
        </Command>,
      );

      const empty = screen.getByTestId("empty");
      expect(empty.className).toContain("text-center");
    });
  });

  describe("CommandGroup", () => {
    it("renders group with items", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Suggestions">
              <CommandItem>Item 1</CommandItem>
              <CommandItem>Item 2</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Suggestions")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Test" className="custom-group" data-testid="group">
              <CommandItem>Item</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      const group = screen.getByTestId("group");
      expect(group).toHaveClass("custom-group");
    });
  });

  describe("CommandItem", () => {
    it("renders item with text", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Command Item</CommandItem>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("Command Item")).toBeInTheDocument();
    });

    it("calls onSelect handler when clicked", async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();
      render(
        <Command>
          <CommandList>
            <CommandItem onSelect={handleSelect}>Click me</CommandItem>
          </CommandList>
        </Command>,
      );

      await user.click(screen.getByText("Click me"));
      expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it("applies custom className", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem className="custom-item">Item</CommandItem>
          </CommandList>
        </Command>,
      );

      const item = screen.getByText("Item");
      expect(item).toHaveClass("custom-item");
    });

    it("disables item when disabled prop is true", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem disabled data-testid="item">
              Disabled Item
            </CommandItem>
          </CommandList>
        </Command>,
      );

      const item = screen.getByTestId("item");
      expect(item).toHaveAttribute("data-disabled", "true");
    });
  });

  describe("CommandShortcut", () => {
    it("renders shortcut text", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>
              Save
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandList>
        </Command>,
      );

      expect(screen.getByText("⌘S")).toBeInTheDocument();
    });

    it("applies default styles", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>
              Copy
              <CommandShortcut data-testid="shortcut">⌘C</CommandShortcut>
            </CommandItem>
          </CommandList>
        </Command>,
      );

      const shortcut = screen.getByTestId("shortcut");
      expect(shortcut.className).toContain("ml-auto");
      expect(shortcut.className).toContain("text-xs");
    });
  });

  describe("CommandSeparator", () => {
    it("renders separator", () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Item 1</CommandItem>
            <CommandSeparator data-testid="separator" />
            <CommandItem>Item 2</CommandItem>
          </CommandList>
        </Command>,
      );

      const separator = screen.getByTestId("separator");
      expect(separator).toBeInTheDocument();
    });

    it("applies separator styles", () => {
      render(
        <Command>
          <CommandList>
            <CommandSeparator data-testid="separator" />
          </CommandList>
        </Command>,
      );

      const separator = screen.getByTestId("separator");
      expect(separator.className).toContain("bg-border");
      expect(separator.className).toContain("h-px");
    });
  });

  describe("Integration", () => {
    it("renders complete command structure", async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();

      render(
        <Command>
          <CommandInput placeholder="Search commands..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem onSelect={handleSelect}>
                Calendar
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={handleSelect}>
                Search
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem onSelect={handleSelect}>Profile</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>,
      );

      // Verify structure
      expect(screen.getByPlaceholderText("Search commands...")).toBeInTheDocument();
      expect(screen.getByText("Suggestions")).toBeInTheDocument();
      expect(screen.getByText("Calendar")).toBeInTheDocument();
      expect(screen.getByText("⌘K")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();

      // Test interaction
      await user.click(screen.getByText("Calendar"));
      expect(handleSelect).toHaveBeenCalledTimes(1);
    });
  });
});
