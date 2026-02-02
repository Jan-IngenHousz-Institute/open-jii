import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  describe("DropdownMenu (Root)", () => {
    it("renders dropdown menu with trigger and content", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="trigger">Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toBeInTheDocument();

      // Content should not be visible initially
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();

      // Click to open
      await user.click(trigger);

      // Content should now be visible
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });
  });

  describe("DropdownMenuItem", () => {
    it("renders menu item with text", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Menu Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      expect(screen.getByText("Menu Item")).toBeInTheDocument();
    });

    it("calls onClick handler when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleClick}>Click me</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await user.click(screen.getByText("Click me"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies custom className", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem className="custom-item">Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const item = screen.getByText("Item");
      expect(item).toHaveClass("custom-item");
    });

    it("applies inset prop class", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const item = screen.getByText("Inset Item");
      expect(item).toHaveClass("pl-8");
    });

    it("applies disabled state attributes when disabled prop is true", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem disabled>Disabled Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const item = screen.getByText("Disabled Item");
      expect(item).toHaveAttribute("data-disabled");
      expect(item).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("DropdownMenuCheckboxItem", () => {
    it("renders checkbox item with checked state", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>Checkbox Item</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const item = screen.getByText("Checkbox Item");
      expect(item).toBeInTheDocument();
      expect(item).toHaveAttribute("data-state", "checked");
    });

    it("toggles checkbox state when clicked", async () => {
      const user = userEvent.setup();
      const handleCheckedChange = vi.fn();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={handleCheckedChange}>
              Toggle me
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await user.click(screen.getByText("Toggle me"));
      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });
  });

  describe("DropdownMenuRadioGroup and DropdownMenuRadioItem", () => {
    it("renders radio items with selection", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const option1 = screen.getByText("Option 1");
      const option2 = screen.getByText("Option 2");

      expect(option1).toHaveAttribute("data-state", "checked");
      expect(option2).toHaveAttribute("data-state", "unchecked");
    });

    it("calls onValueChange when radio item is selected", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1" onValueChange={handleValueChange}>
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      await user.click(screen.getByText("Option 2"));
      expect(handleValueChange).toHaveBeenCalledWith("option2");
    });
  });

  describe("DropdownMenuLabel", () => {
    it("renders label text", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Label Text</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      expect(screen.getByText("Label Text")).toBeInTheDocument();
    });

    it("applies inset class when inset prop is true", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const label = screen.getByText("Inset Label");
      expect(label).toHaveClass("pl-8");
    });
  });

  describe("DropdownMenuSeparator", () => {
    it("renders separator", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator data-testid="separator" />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const separator = screen.getByTestId("separator");
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass("bg-muted");
    });
  });

  describe("DropdownMenuShortcut", () => {
    it("renders shortcut text", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Save
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      expect(screen.getByText("⌘S")).toBeInTheDocument();
    });
  });

  describe("DropdownMenuSub", () => {
    it("renders submenu with trigger and content", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Submenu Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const subTrigger = screen.getByText("More options");
      expect(subTrigger).toBeInTheDocument();

      // Hover to open submenu
      await user.hover(subTrigger);

      // Wait a bit for submenu to appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.getByText("Submenu Item")).toBeInTheDocument();
    });

    it("applies inset class to SubTrigger when inset prop is true", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Inset Submenu</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const subTrigger = screen.getByText("Inset Submenu");
      expect(subTrigger).toHaveClass("pl-8");
    });
  });

  describe("DropdownMenuGroup", () => {
    it("renders group with multiple items", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem>Group Item 1</DropdownMenuItem>
              <DropdownMenuItem>Group Item 2</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      expect(screen.getByText("Group Item 1")).toBeInTheDocument();
      expect(screen.getByText("Group Item 2")).toBeInTheDocument();
    });
  });

  describe("DropdownMenuContent", () => {
    it("applies custom className", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-content" data-testid="content">
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const content = screen.getByTestId("content");
      expect(content).toHaveClass("custom-content");
    });

    it("respects sideOffset prop", async () => {
      const user = userEvent.setup();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={10} data-testid="content">
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await user.click(screen.getByText("Open"));
      const content = screen.getByTestId("content");
      expect(content).toBeInTheDocument();
    });
  });
});
