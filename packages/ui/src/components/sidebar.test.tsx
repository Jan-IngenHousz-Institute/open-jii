import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "./sidebar";

// Mock window.matchMedia for JSDOM
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

// Helper component to test useSidebar hook
function SidebarConsumer() {
  const { state, open, toggleSidebar } = useSidebar();
  return (
    <div>
      <span data-testid="sidebar-state">{state}</span>
      <span data-testid="sidebar-open">{open ? "true" : "false"}</span>
      <button onClick={toggleSidebar} data-testid="toggle-button">
        Toggle
      </button>
    </div>
  );
}

describe("SidebarProvider", () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie = "sidebar_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  it("renders children correctly", () => {
    render(
      <SidebarProvider>
        <div data-testid="child">Child content</div>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides default open state as expanded", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
  });

  it("respects defaultOpen prop set to false", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
  });

  it("toggles sidebar state when toggleSidebar is called", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    await user.click(screen.getByTestId("toggle-button"));

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
  });

  it("handles controlled state with open prop", () => {
    const { rerender } = render(
      <SidebarProvider open={true}>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");

    rerender(
      <SidebarProvider open={false}>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
  });

  it("calls onOpenChange when state changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SidebarProvider onOpenChange={onOpenChange}>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    await user.click(screen.getByTestId("toggle-button"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Sidebar", () => {
  it("renders with default variant and side", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar>
          <div>Sidebar content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-variant="sidebar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-side="left"]')).toBeInTheDocument();
  });

  it("renders with right side", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar side="right">
          <div>Sidebar content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-side="right"]')).toBeInTheDocument();
  });

  it("renders with floating variant", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar variant="floating">
          <div>Sidebar content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-variant="floating"]')).toBeInTheDocument();
  });

  it("renders with collapsible none", () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <div data-testid="sidebar-content">Sidebar content</div>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
  });
});

describe("SidebarTrigger", () => {
  it("renders a button with icon", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("toggles sidebar when clicked", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <SidebarTrigger />
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    // Use data-sidebar attribute to find the specific trigger button
    const triggerButton = document.querySelector('[data-sidebar="trigger"]') as HTMLElement;
    await user.click(triggerButton);

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
  });

  it("calls custom onClick handler if provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <SidebarProvider>
        <SidebarTrigger onClick={onClick} />
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalled();
  });
});

describe("SidebarHeader", () => {
  it("renders children correctly", () => {
    render(
      <SidebarProvider>
        <SidebarHeader>
          <h2 data-testid="header-title">Header Title</h2>
        </SidebarHeader>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("header-title")).toBeInTheDocument();
    expect(screen.getByTestId("header-title")).toHaveTextContent("Header Title");
  });

  it("applies custom className", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarHeader className="custom-header">
          <div>Header</div>
        </SidebarHeader>
      </SidebarProvider>,
    );

    const header = container.querySelector('[data-sidebar="header"]');
    expect(header).toHaveClass("custom-header");
  });
});

describe("SidebarContent", () => {
  it("renders children correctly", () => {
    render(
      <SidebarProvider>
        <SidebarContent>
          <div data-testid="content">Main content</div>
        </SidebarContent>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("applies data attribute", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarContent>
          <div>Content</div>
        </SidebarContent>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-sidebar="content"]')).toBeInTheDocument();
  });
});

describe("SidebarFooter", () => {
  it("renders children correctly", () => {
    render(
      <SidebarProvider>
        <SidebarFooter>
          <div data-testid="footer">Footer content</div>
        </SidebarFooter>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("applies data attribute", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarFooter>
          <div>Footer</div>
        </SidebarFooter>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-sidebar="footer"]')).toBeInTheDocument();
  });
});

describe("SidebarMenu and SidebarMenuItem", () => {
  it("renders menu items correctly", () => {
    render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <div data-testid="menu-item-1">Item 1</div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div data-testid="menu-item-2">Item 2</div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );

    expect(screen.getByTestId("menu-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-2")).toBeInTheDocument();
  });

  it("applies correct data attributes", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <div>Item</div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-sidebar="menu"]')).toBeInTheDocument();
    expect(container.querySelector('[data-sidebar="menu-item"]')).toBeInTheDocument();
  });
});

describe("SidebarMenuButton", () => {
  it("renders a button with text", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton>Dashboard</SidebarMenuButton>
      </SidebarProvider>,
    );

    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("applies active state when isActive is true", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarMenuButton isActive={true}>Active Item</SidebarMenuButton>
      </SidebarProvider>,
    );

    const button = container.querySelector('[data-active="true"]');
    expect(button).toBeInTheDocument();
  });

  it("renders with different sizes", () => {
    const { container: smallContainer } = render(
      <SidebarProvider>
        <SidebarMenuButton size="sm">Small</SidebarMenuButton>
      </SidebarProvider>,
    );

    const smallButton = smallContainer.querySelector('[data-size="sm"]');
    expect(smallButton).toBeInTheDocument();

    const { container: largeContainer } = render(
      <SidebarProvider>
        <SidebarMenuButton size="lg">Large</SidebarMenuButton>
      </SidebarProvider>,
    );

    const largeButton = largeContainer.querySelector('[data-size="lg"]');
    expect(largeButton).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <SidebarProvider>
        <SidebarMenuButton onClick={onClick}>Click me</SidebarMenuButton>
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("SidebarSeparator", () => {
  it("renders a separator", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarSeparator />
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-sidebar="separator"]')).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarSeparator className="custom-separator" />
      </SidebarProvider>,
    );

    const separator = container.querySelector('[data-sidebar="separator"]');
    expect(separator).toHaveClass("custom-separator");
  });
});

describe("useSidebar hook", () => {
  it("throws error when used outside SidebarProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(
        <div>
          <SidebarConsumer />
        </div>,
      );
    }).toThrow("useSidebar must be used within a SidebarProvider.");

    consoleSpy.mockRestore();
  });
});

describe("Keyboard shortcuts", () => {
  it("toggles sidebar with Cmd+B on Mac", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.keyDown(window, { key: "b", metaKey: true });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
  });

  it("toggles sidebar with Ctrl+B", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
  });

  it("does not toggle without modifier key", () => {
    render(
      <SidebarProvider>
        <SidebarConsumer />
      </SidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.keyDown(window, { key: "b" });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
  });
});
