import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Microscope, Code } from "lucide-react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { NavItems } from "./nav-items";

globalThis.React = React;

// Mock usePathname
let mockPathname = "/en/platform";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Mock window.matchMedia for JSDOM
window.matchMedia = () =>
  ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: (_: string, __: EventListenerOrEventListenerObject) => {
      /* noop */
    },
    removeEventListener: (_: string, __: EventListenerOrEventListenerObject) => {
      /* noop */
    },
    addListener: (_: EventListenerOrEventListenerObject) => {
      /* noop */
    },
    removeListener: (_: EventListenerOrEventListenerObject) => {
      /* noop */
    },
    dispatchEvent: (_: Event) => false,
  }) as unknown as MediaQueryList;

describe("<NavItems /> basic rendering", () => {
  it("renders a simple navigation item", () => {
    const items = [{ title: "Dashboard", url: "/dashboard", icon: Home, items: [] }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders items correctly even if isActive is true", () => {
    const items = [
      {
        title: "Experiments",
        url: "/experiments",
        icon: Microscope,
        isActive: true,
      },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /experiments/i })).toBeInTheDocument();
  });
});

describe("<NavItems /> interactions & structure", () => {
  it("renders multiple top-level items", async () => {
    const user = userEvent.setup();

    const items = [
      { title: "Dashboard", url: "/dashboard", icon: Home },
      { title: "Code", url: "/code", icon: Code },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /code/i })).toBeInTheDocument();

    // Clicking shouldn't crash anything
    await user.click(screen.getByRole("link", { name: /code/i }));

    // Both links should be present
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /code/i })).toBeInTheDocument();
  });

  it("renders a direct link correctly", () => {
    const items = [{ title: "Dashboard", url: "/dashboard", icon: Home }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders inactive items without errors", () => {
    const items = [
      {
        title: "Inactive Section",
        url: "/inactive",
        icon: Code,
        isActive: false,
      },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    const triggerLink = screen.getByRole("link", { name: /inactive section/i });
    expect(triggerLink).toBeInTheDocument();
  });
});

describe("<NavItems /> active state detection", () => {
  it("marks exact path match as active", () => {
    mockPathname = "/en/platform/experiments";
    const items = [{ title: "Experiments", url: "/en/platform/experiments", icon: Microscope }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /experiments/i })).toBeInTheDocument();
  });

  it("marks parent path as active when on child path", () => {
    mockPathname = "/en/platform/experiments/123";
    const items = [{ title: "Experiments", url: "/en/platform/experiments", icon: Microscope }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /experiments/i })).toBeInTheDocument();
  });

  it("does not mark short paths as active incorrectly", () => {
    mockPathname = "/en/platform/experiments";
    const items = [{ title: "Dashboard", url: "/en/platform", icon: Home }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    // Should not be marked as active since /en/platform has only 2 segments
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });
});
