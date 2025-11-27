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

// Mock NavUser component
vi.mock("./nav-user/nav-user", () => ({
  NavUser: ({ locale, user }: { locale: string; user: { id: string; email: string } }) => (
    <div data-testid="nav-user" data-locale={locale} data-user-id={user.id} />
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/ui/components")>();
  return {
    ...actual,
  };
});

describe("AppSidebar", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    image: "/avatar.jpg",
  };

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
    experimentsTitle: "Experiments",
    hardwareTitle: "Hardware",
    macrosTitle: "Macros",
  };

  it("renders logo", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          user={mockUser}
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    expect(screen.getByAltText("JII Logo")).toBeInTheDocument();
  });

  it("renders NavUser component when user is provided", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          user={mockUser}
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const navUser = screen.getByTestId("nav-user");
    expect(navUser).toBeInTheDocument();
    expect(navUser).toHaveAttribute("data-locale", "en");
    expect(navUser).toHaveAttribute("data-user-id", "user-123");
  });

  it("renders all navigation sections", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    render(
      <SidebarProvider>
        <AppSidebar
          user={mockUser}
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
          user={mockUser}
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    expect(screen.getByText("Create")).toBeInTheDocument();
  });   user={mockUser}
  it("shows dropdown menu with create options when button is clicked", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar
          user={mockUser}
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    // Should show protocol, experiment, and macro options
    const protocolLink = screen.getByRole("menuitem", { name: "Protocol" });
    const experimentLink = screen.getByRole("menuitem", { name: "Experiment" });
    const macroLink = screen.getByRole("menuitem", { name: "Macro" });

    expect(protocolLink).toBeInTheDocument();
    expect(experimentLink).toBeInTheDocument();
    expect(macroLink).toBeInTheDocument();
  });

  it("create dropdown links have correct hrefs", async () => {
    const { SidebarProvider } = await import("@repo/ui/components");
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <AppSidebar
          user={mockUser}
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    const protocolLink = screen.getByRole("menuitem", { name: "Protocol" });
    const experimentLink = screen.getByRole("menuitem", { name: "Experiment" });
    const macroLink = screen.getByRole("menuitem", { name: "Macro" });

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
          user={mockUser}
          locale="de"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    const protocolLink = screen.getByRole("menuitem", { name: "Protocol" });
    expect(protocolLink).toHaveAttribute("href", "/de/platform/protocols/new");
  });   translations={mockTranslations}
      />,
    );

    const createButton = screen.getByText("Create");
    await user.click(createButton);

    const protocolLink = screen.getByRole("menuitem", { name: "Protocol" });
    expect(protocolLink).toHaveAttribute("href", "/de/platform/protocols/new");
  });
});
