import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { NavTabs, NavTabsList, NavTabsTrigger, NavTabsContent } from "../nav-tabs";

describe("NavTabs", () => {
  describe("NavTabs (Root)", () => {
    it("renders tabs root with children", () => {
      render(
        <NavTabs defaultValue="tab1" data-testid="nav-tabs">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      expect(screen.getByTestId("nav-tabs")).toBeInTheDocument();
    });

    it("respects defaultValue prop", () => {
      render(
        <NavTabs defaultValue="tab2">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content 2")).toBeInTheDocument();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });

    it("respects controlled value prop", () => {
      render(
        <NavTabs value="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });
  });

  describe("NavTabsList", () => {
    it("renders tabs list with default classes", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList data-testid="tabs-list">
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      const list = screen.getByTestId("tabs-list");
      expect(list).toBeInTheDocument();
      // Underline-style tabs: inline-flex row, capped at max-w-full, with a 2px
      // baseline that matches the active indicator's height.
      // Assert exact class tokens so e.g. "flex" can't pass on "inline-flex".
      const tokens = list.className.split(/\s+/);
      expect(tokens).toContain("inline-flex");
      expect(tokens).toContain("max-w-full");
      expect(tokens).toContain("border-b-2");
      expect(tokens).toContain("gap-6");
    });

    it("applies custom className to tabs list", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList className="custom-list-class" data-testid="tabs-list">
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      const list = screen.getByTestId("tabs-list");
      expect(list.className).toContain("custom-list-class");
    });

    it("forwards ref correctly", () => {
      const ref = vi.fn();
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList ref={ref as any}>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("NavTabsTrigger", () => {
    it("renders tab trigger with text", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      expect(screen.getByRole("tab", { name: /tab 1/i })).toBeInTheDocument();
    });

    it("applies active state classes when selected", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1" data-testid="active-trigger">
              Active Tab
            </NavTabsTrigger>
            <NavTabsTrigger value="tab2" data-testid="inactive-trigger">
              Inactive Tab
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      const activeTrigger = screen.getByTestId("active-trigger");
      const inactiveTrigger = screen.getByTestId("inactive-trigger");

      expect(activeTrigger).toHaveAttribute("data-state", "active");
      expect(inactiveTrigger).toHaveAttribute("data-state", "inactive");

      // Active tab is marked by brand-teal text; the underline itself is drawn by
      // the list's separate sliding indicator, not a per-trigger border.
      expect(activeTrigger.className).toContain("data-[state=active]:text-primary");
    });

    it("applies custom className to trigger", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1" className="custom-trigger-class">
              Tab 1
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      const trigger = screen.getByRole("tab");
      expect(trigger.className).toContain("custom-trigger-class");
    });

    it("handles disabled state", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1" disabled>
              Disabled Tab
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      const trigger = screen.getByRole("tab");
      expect(trigger).toBeDisabled();
    });

    it("switches tabs when clicked", async () => {
      const user = userEvent.setup();

      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 2/i }));

      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.getByText("Content 2")).toBeInTheDocument();
    });

    it("forwards ref correctly", () => {
      const ref = vi.fn();
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1" ref={ref as any}>
              Tab 1
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("NavTabsContent", () => {
    it("renders content for active tab", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content for Tab 1</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content for Tab 1")).toBeInTheDocument();
    });

    it("does not render content for inactive tab", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("applies default mt-3 class", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1" data-testid="content">
            Content
          </NavTabsContent>
        </NavTabs>,
      );

      const content = screen.getByTestId("content");
      expect(content.className).toContain("mt-3");
    });

    it("applies custom className to content", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1" className="custom-content-class" data-testid="content">
            Content
          </NavTabsContent>
        </NavTabs>,
      );

      const content = screen.getByTestId("content");
      expect(content.className).toContain("custom-content-class");
      expect(content.className).toContain("mt-3");
    });

    it("forwards ref correctly", () => {
      const ref = vi.fn();
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1" ref={ref as any}>
            Content
          </NavTabsContent>
        </NavTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("Integration", () => {
    it("renders complete tabs component with multiple tabs and content", () => {
      render(
        <NavTabs defaultValue="overview">
          <NavTabsList>
            <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
            <NavTabsTrigger value="data">Data</NavTabsTrigger>
            <NavTabsTrigger value="analysis">Analysis</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="overview">Overview content</NavTabsContent>
          <NavTabsContent value="data">Data content</NavTabsContent>
          <NavTabsContent value="analysis">Analysis content</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /data/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /analysis/i })).toBeInTheDocument();
      expect(screen.getByText("Overview content")).toBeInTheDocument();
    });

    it("switches between multiple tabs correctly", async () => {
      const user = userEvent.setup();

      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
            <NavTabsTrigger value="tab3">Tab 3</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
          <NavTabsContent value="tab3">Content 3</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 2/i }));
      expect(screen.getByText("Content 2")).toBeInTheDocument();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 3/i }));
      expect(screen.getByText("Content 3")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 1/i }));
      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 3")).not.toBeInTheDocument();
    });

    it("handles tabs with complex content including links", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">
              <a href="/path1">Link Tab 1</a>
            </NavTabsTrigger>
            <NavTabsTrigger value="tab2">
              <a href="/path2">Link Tab 2</a>
            </NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">
            <div>
              <h2>Complex Content</h2>
              <p>With nested elements</p>
            </div>
          </NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      expect(screen.getByText("Link Tab 1")).toBeInTheDocument();
      expect(screen.getByText("Link Tab 2")).toBeInTheDocument();
      expect(screen.getByText("Complex Content")).toBeInTheDocument();
      expect(screen.getByText("With nested elements")).toBeInTheDocument();
    });

    it("maintains accessibility attributes", () => {
      render(
        <NavTabs defaultValue="tab1">
          <NavTabsList>
            <NavTabsTrigger value="tab1">Tab 1</NavTabsTrigger>
            <NavTabsTrigger value="tab2">Tab 2</NavTabsTrigger>
          </NavTabsList>
          <NavTabsContent value="tab1">Content 1</NavTabsContent>
          <NavTabsContent value="tab2">Content 2</NavTabsContent>
        </NavTabs>,
      );

      const tab1 = screen.getByRole("tab", { name: /tab 1/i });
      const tab2 = screen.getByRole("tab", { name: /tab 2/i });

      expect(tab1).toHaveAttribute("role", "tab");
      expect(tab2).toHaveAttribute("role", "tab");
      expect(tab1).toHaveAttribute("data-state", "active");
      expect(tab2).toHaveAttribute("data-state", "inactive");
    });
  });

  describe("Mobile dropdown", () => {
    const originalMatchMedia = window.matchMedia;

    // Force the mobile breakpoint so NavTabsList renders its dropdown variant.
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it("collapses tabs into a dropdown labelled by the active tab", () => {
      render(
        <NavTabs value="data">
          <NavTabsList>
            <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
            <NavTabsTrigger value="data">Data</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      // Closed dropdown shows the active tab's label; the tab rows stay collapsed.
      expect(screen.getByRole("button", { name: /data/i })).toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    });

    it("reveals the tabs when the dropdown is opened", async () => {
      const user = userEvent.setup();

      render(
        <NavTabs value="overview">
          <NavTabsList>
            <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
            <NavTabsTrigger value="data">Data</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      await user.click(screen.getByRole("button", { name: /overview/i }));

      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /data/i })).toBeInTheDocument();
    });

    it("collapses the dropdown again once a tab is selected", async () => {
      const user = userEvent.setup();

      render(
        <NavTabs value="overview">
          <NavTabsList>
            <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
            <NavTabsTrigger value="data">Data</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      await user.click(screen.getByRole("button", { name: /overview/i }));
      await user.click(screen.getByRole("tab", { name: /data/i }));

      // Selecting a row closes the popover, so the tab rows collapse back to the button.
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("runs a consumer-supplied onClick and still closes the dropdown on selection", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <NavTabs value="overview">
          <NavTabsList onClick={onClick}>
            <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
            <NavTabsTrigger value="data">Data</NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      await user.click(screen.getByRole("button", { name: /overview/i }));
      await user.click(screen.getByRole("tab", { name: /data/i }));

      // The consumer's handler is composed with the internal one (not clobbered by it)...
      expect(onClick).toHaveBeenCalled();
      // ...and the internal close behavior still fires.
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    });

    it("labels the closed dropdown from an asChild trigger's inner content", () => {
      render(
        <NavTabs value="data">
          <NavTabsList>
            <NavTabsTrigger value="overview" asChild>
              <a href="/overview">Overview</a>
            </NavTabsTrigger>
            <NavTabsTrigger value="data" asChild>
              <a href="/data">Data</a>
            </NavTabsTrigger>
          </NavTabsList>
        </NavTabs>,
      );

      // The active trigger wraps a link, so its label lives one level in — the button still reads "Data".
      expect(screen.getByRole("button", { name: /data/i })).toBeInTheDocument();
    });
  });
});
