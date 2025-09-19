import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Microscope, Code } from "lucide-react";
// real icons now
import React from "react";
import { describe, it, expect } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { NavItems } from "./nav-items";

globalThis.React = React;

// Mock window.matchMedia for JSDOM
window.matchMedia = () =>
  ({
    matches: false,
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
    onchange: null,
    dispatchEvent: (_: Event) => false,
  }) as MediaQueryList;

describe("<NavItems /> basic rendering", () => {
  it("renders navigation items with titles", () => {
    const items = [{ title: "Dashboard", url: "/dashboard", icon: Home, items: [] }];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders items with sub-items when default-open (isActive=true)", () => {
    const items = [
      {
        title: "Experiments",
        url: "/experiments",
        icon: Microscope,
        isActive: true,
        items: [
          { title: "Experiment 1", url: "/experiments/1" },
          { title: "Experiment 2", url: "/experiments/2" },
        ],
      },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("button", { name: /experiments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /experiment 1/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /experiment 2/i })).toBeInTheDocument();
  });
});

describe("<NavItems /> interactions & structure", () => {
  it("renders multiple items and reveals sub-item after expanding", async () => {
    const user = userEvent.setup();

    const items = [
      { title: "Dashboard", url: "/dashboard", icon: Home, items: [] },
      { title: "Code", url: "/code", icon: Code, items: [{ title: "File 1", url: "/code/1" }] },
    ];

    const { container } = render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /code/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /file 1/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /code/i }));
    expect(screen.getByRole("link", { name: /file 1/i })).toBeInTheDocument();

    const topLevelLis = container.querySelectorAll('li[data-sidebar="menu-item"]');
    expect(topLevelLis.length).toBe(2);
  });

  it("renders direct links for items without sub-items", () => {
    const items = [{ title: "Dashboard", url: "/dashboard", icon: Home, items: [] }];

    const { container } = render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    expect(container.querySelector('[data-sidebar="group"]')).toBeTruthy();
    expect(container.querySelector('[data-sidebar="menu"]')).toBeTruthy();
    expect(container.querySelector('li[data-sidebar="menu-item"]')).toBeTruthy();

    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders collapsible items with sub-items and proper aria when open", () => {
    const items = [
      {
        title: "Experiments",
        url: "/experiments",
        icon: Microscope,
        isActive: true,
        items: [
          { title: "Experiment 1", url: "/experiments/1" },
          { title: "Experiment 2", url: "/experiments/2" },
        ],
      },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: /experiments/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByRole("link", { name: /experiment 1/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /experiment 2/i })).toBeInTheDocument();
  });

  it("renders multiple items with mixed types (count top-level items)", () => {
    const items = [
      { title: "Dashboard", url: "/dashboard", icon: Home, items: [] },
      { title: "Code", url: "/code", icon: Code, items: [{ title: "File 1", url: "/code/1" }] },
    ];

    const { container } = render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    const topLevelLis = container.querySelectorAll('li[data-sidebar="menu-item"]');
    expect(topLevelLis.length).toBe(2);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /code/i })).toBeInTheDocument();
  });

  it("renders inactive collapsible items (closed by default)", () => {
    const items = [
      {
        title: "Inactive Section",
        url: "/inactive",
        icon: Code,
        isActive: false,
        items: [{ title: "Sub Item", url: "/inactive/1" }],
      },
    ];

    render(
      <SidebarProvider>
        <NavItems items={items} />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: /inactive section/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /sub item/i })).not.toBeInTheDocument();
  });
});
