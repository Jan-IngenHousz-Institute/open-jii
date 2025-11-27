import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";

globalThis.React = React;

// Mock window.matchMedia
window.matchMedia = () =>
  ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

// Mock Next.js components
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    locale,
  }: {
    href: string;
    children: React.ReactNode;
    locale?: string;
  }) => (
    <a href={href} data-locale={locale}>
      {children}
    </a>
  ),
}));

// Mock NavItems
vi.mock("./nav-items", () => ({
  NavItems: ({ items }: { items: { title: string }[] }) => (
    <div data-testid="nav-items">
      {items.map((item, i) => (
        <div key={i}>{item.title}</div>
      ))}
    </div>
  ),
}));

describe("AppSidebar", () => {
  const mockNavigationData = {
    navDashboard: [{ title: "Dashboard", url: "/en/platform", icon: "Home", items: [] }],
    navExperiments: [
      {
        title: "Experiments",
        url: "/en/platform/experiments",
        icon: "Microscope",
        items: [],
      },
    ],
    navHardware: [
      { title: "Protocols", url: "/en/platform/protocols", icon: "FileSliders", items: [] },
    ],
    navMacros: [{ title: "Macros", url: "/en/platform/macros", icon: "Code", items: [] }],
  };

  const mockTranslations = {
    openJII: "Open JII",
    logoAlt: "JII Logo",
    signIn: "Sign In",
    create: "Create",
    protocol: "Protocol",
    experiment: "Experiment",
    macro: "Macro",
    experimentsTitle: "Experiments",
    hardwareTitle: "Hardware",
    macrosTitle: "Macros",
  };

  it("renders logo", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    expect(screen.getByAltText("JII Logo")).toBeInTheDocument();
  });

  it("renders all navigation sections", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const navItems = screen.getAllByTestId("nav-items");
    expect(navItems).toHaveLength(4); // Dashboard, Experiments, Hardware, Macros
  });

  it("renders create button", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("shows dropdown menu with create options when button is clicked", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    // Should show protocol, experiment, and macro options
    expect(screen.getByText("Protocol")).toBeInTheDocument();
    expect(screen.getByText("Experiment")).toBeInTheDocument();
    expect(screen.getByText("Macro")).toBeInTheDocument();
  });

  it("create dropdown links have correct hrefs", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    const protocolLink = screen.getByText("Protocol").closest("a");
    const experimentLink = screen.getByText("Experiment").closest("a");
    const macroLink = screen.getByText("Macro").closest("a");

    expect(protocolLink).toHaveAttribute("href", "/en/platform/protocols/new");
    expect(experimentLink).toHaveAttribute("href", "/en/platform/experiments/new");
    expect(macroLink).toHaveAttribute("href", "/en/platform/macros/new");
  });

  it("respects locale in dropdown links", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar
          locale="de"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    const protocolLink = screen.getByText("Protocol").closest("a");
    expect(protocolLink).toHaveAttribute("href", "/de/platform/protocols/new");
  });
});
