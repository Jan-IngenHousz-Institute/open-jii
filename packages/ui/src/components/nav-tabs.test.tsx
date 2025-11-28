import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { NavTabs, NavTabsList, NavTabsTrigger, NavTabsContent } from "./nav-tabs";

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
      expect(list.className).toContain("bg-surface");
      expect(list.className).toContain("inline-flex");
      expect(list.className).toContain("gap-1");
      expect(list.className).toContain("rounded-xl");
      expect(list.className).toContain("p-1");
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

      // Check for base classes that should be present
      expect(activeTrigger.className).toContain("rounded-lg");
      expect(activeTrigger.className).toContain("px-4");
      expect(activeTrigger.className).toContain("py-2");
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
});
