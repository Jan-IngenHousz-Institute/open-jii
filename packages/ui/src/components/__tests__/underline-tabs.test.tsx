import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import {
  UnderlineTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  UnderlineTabsContent,
} from "../underline-tabs";

describe("UnderlineTabs", () => {
  describe("UnderlineTabs (Root)", () => {
    it("renders with children", () => {
      render(
        <UnderlineTabs defaultValue="tab1" data-testid="underline-tabs">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByTestId("underline-tabs")).toBeInTheDocument();
    });

    it("respects defaultValue prop", () => {
      render(
        <UnderlineTabs defaultValue="tab2">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Content 2")).toBeInTheDocument();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });

    it("respects controlled value prop", () => {
      render(
        <UnderlineTabs value="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });
  });

  describe("UnderlineTabsList", () => {
    it("renders with scrollable and border classes", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList data-testid="tabs-list">
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      const list = screen.getByTestId("tabs-list");
      expect(list).toBeInTheDocument();
      expect(list.className).toContain("overflow-x-auto");
      expect(list.className).toContain("border-b");
      expect(list.className).toContain("flex");
    });

    it("applies custom className", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList className="custom-list" data-testid="tabs-list">
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByTestId("tabs-list").className).toContain("custom-list");
    });

    it("forwards ref", () => {
      const ref = vi.fn();
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList ref={ref as any}>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("UnderlineTabsTrigger", () => {
    it("renders tab with text", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByRole("tab", { name: /tab 1/i })).toBeInTheDocument();
    });

    it("marks active and inactive tabs with data-state", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" data-testid="active-tab">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2" data-testid="inactive-tab">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByTestId("active-tab")).toHaveAttribute("data-state", "active");
      expect(screen.getByTestId("inactive-tab")).toHaveAttribute("data-state", "inactive");
    });

    it("has underline-style base classes", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" data-testid="trigger">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger.className).toContain("border-b-2");
      expect(trigger.className).toContain("border-transparent");
      expect(trigger.className).toContain("px-3");
    });

    it("renders count badge when count is provided", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" count={5}>Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("renders count badge when count is 0", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" count={0}>Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("does not render count badge when count is not provided", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" data-testid="trigger">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      const trigger = screen.getByTestId("trigger");
      // Only the label span should be inside — no badge
      expect(trigger.querySelectorAll("span")).toHaveLength(1);
    });

    it("handles disabled state", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab2" disabled>Disabled Tab</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByRole("tab", { name: /disabled tab/i })).toBeDisabled();
    });

    it("applies custom className", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" className="custom-trigger">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByRole("tab").className).toContain("custom-trigger");
    });

    it("forwards ref", () => {
      const ref = vi.fn();
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1" ref={ref as any}>Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("UnderlineTabsContent", () => {
    it("renders content for active tab", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content for Tab 1</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Content for Tab 1")).toBeInTheDocument();
    });

    it("does not render content for inactive tab", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("applies default mt-4 class", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1" data-testid="content">Content</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByTestId("content").className).toContain("mt-4");
    });

    it("applies custom className alongside default", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1" className="custom-content" data-testid="content">
            Content
          </UnderlineTabsContent>
        </UnderlineTabs>,
      );

      const content = screen.getByTestId("content");
      expect(content.className).toContain("custom-content");
      expect(content.className).toContain("mt-4");
    });

    it("forwards ref", () => {
      const ref = vi.fn();
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1" ref={ref as any}>Content</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("Integration", () => {
    it("switches tabs when clicked", async () => {
      const user = userEvent.setup();

      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 2/i }));

      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.getByText("Content 2")).toBeInTheDocument();
    });

    it("cycles through multiple tabs correctly", async () => {
      const user = userEvent.setup();

      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab3">Tab 3</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
          <UnderlineTabsContent value="tab3">Content 3</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      await user.click(screen.getByRole("tab", { name: /tab 2/i }));
      expect(screen.getByText("Content 2")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /tab 3/i }));
      expect(screen.getByText("Content 3")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("cannot switch to a disabled tab", async () => {
      const user = userEvent.setup();

      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2" disabled>Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
      );

      await user.click(screen.getByRole("tab", { name: /tab 2/i }));

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
    });

    it("renders count badges alongside tab labels", () => {
      render(
        <UnderlineTabs defaultValue="members">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="members" count={3}>Members</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="invited" count={1}>Invited</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="requests" count={0}>Requests</UnderlineTabsTrigger>
          </UnderlineTabsList>
        </UnderlineTabs>,
      );

      expect(screen.getByText("Members")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("Invited")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("Requests")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("maintains accessibility attributes", () => {
      render(
        <UnderlineTabs defaultValue="tab1">
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="tab1">Tab 1</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="tab2">Tab 2</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <UnderlineTabsContent value="tab1">Content 1</UnderlineTabsContent>
          <UnderlineTabsContent value="tab2">Content 2</UnderlineTabsContent>
        </UnderlineTabs>,
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
