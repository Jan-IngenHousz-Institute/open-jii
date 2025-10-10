import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { AppSidebar } from "../app-sidebar";

// Mock the Image component from next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width: _width,
    height: _height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => <span data-testid="next-image" data-src={src} data-alt={alt} />,
}));

// Mock the Link component from next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    locale,
    children,
  }: {
    href: string;
    locale: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-locale={locale}>
      {children}
    </a>
  ),
}));

// Mock the Sidebar components
vi.mock("@repo/ui/components", () => ({
  Sidebar: ({ children, collapsible }: { children: React.ReactNode; collapsible: string }) => (
    <div data-testid="sidebar" data-collapsible={collapsible}>
      {children}
    </div>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu">{children}</div>
  ),
  SidebarMenuButton: ({
    asChild,
    className,
    children,
  }: {
    asChild: boolean;
    className: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="sidebar-menu-button" data-as-child={asChild} className={className}>
      {children}
    </div>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

// Mock NavItems component
vi.mock("../nav-items", () => ({
  NavItems: ({
    items,
  }: {
    items: {
      title: string;
      url: string;
      icon: React.ComponentType;
      isActive?: boolean;
    }[];
  }) => (
    <div data-testid="nav-items">
      {items.map((item, i) => (
        <div key={i} data-item-title={item.title}>
          <item.icon data-testid={`item-icon-${item.title.toLowerCase()}`} />
          <span>{item.title}</span>
        </div>
      ))}
    </div>
  ),
}));

// Mock NavUser component
vi.mock("../nav-user/nav-user", () => ({
  NavUser: ({
    locale,
    user,
  }: {
    locale: string;
    user: { id: string; email: string; avatar: string };
  }) => (
    <div
      data-testid="nav-user"
      data-locale={locale}
      data-user-id={user.id}
      data-user-email={user.email}
      data-user-avatar={user.avatar}
    />
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Home: () => <div data-testid="icon-home" />,
  BookOpen: () => <div data-testid="icon-book-open" />,
  Microscope: () => <div data-testid="icon-microscope" />,
  Archive: () => <div data-testid="icon-archive" />,
  Webcam: () => <div data-testid="icon-webcam" />,
  FileSliders: () => <div data-testid="icon-file-sliders" />,
  RadioReceiver: () => <div data-testid="icon-radio-receiver" />,
  Code: () => <div data-testid="icon-code" />,
  LogIn: () => <div data-testid="icon-login" />,
}));

describe("<AppSidebar />", () => {
  const mockUser = {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    image: "/test-avatar.jpg",
  };

  const mockNavigationData = {
    navDashboard: [
      {
        title: "Dashboard",
        url: "/platform/",
        icon: "Home",
        isActive: true,
        items: [],
      },
    ],
    navExperiments: [
      {
        title: "Experiments",
        url: "/platform/experiments",
        icon: "Microscope",
        isActive: true,
        items: [],
      },
    ],
    navHardware: [
      {
        title: "Hardware",
        url: "/platform/hardware",
        icon: "RadioReceiver",
        items: [],
      },
    ],
    navMacros: [
      {
        title: "Macros",
        url: "/platform/macros",
        icon: "Code",
        items: [],
      },
    ],
  };

  const mockTranslations = {
    openJII: "Open JII",
    logoAlt: "Open JII Logo",
    signIn: "Sign In",
    experimentsTitle: "Experiments",
    hardwareTitle: "Hardware",
    macrosTitle: "Macros",
  };

  it("renders the sidebar structure correctly", () => {
    render(
      <AppSidebar
        user={mockUser}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={mockTranslations}
      />,
    );

    // Check main sidebar structure
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-header")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-footer")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-rail")).toBeInTheDocument();
  });

  it("renders the logo and title in the header", () => {
    render(
      <AppSidebar
        user={mockUser}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={mockTranslations}
      />,
    );

    const image = screen.getByTestId("next-image");
    expect(image).toHaveAttribute("data-src", "/logo-platform.png");
    expect(image).toHaveAttribute("data-alt", "Open JII Logo");
  });

  it("renders NavUser component when user is provided", () => {
    render(
      <AppSidebar
        user={mockUser}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={mockTranslations}
      />,
    );

    const navUser = screen.getByTestId("nav-user");
    expect(navUser).toBeInTheDocument();
    expect(navUser).toHaveAttribute("data-locale", "en-US");
    expect(navUser).toHaveAttribute("data-user-id", "user-123");
    expect(navUser).toHaveAttribute("data-user-email", "test@example.com");
    expect(navUser).toHaveAttribute("data-user-avatar", "/test-avatar.jpg");
  });

  it("renders sign-in link and icon when user is not provided", () => {
    render(
      <AppSidebar
        user={null}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={mockTranslations}
      />,
    );

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByTestId("icon-login")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-user")).not.toBeInTheDocument();
  });

  it("renders mapped icons for navigation items", () => {
    render(
      <AppSidebar
        user={mockUser}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={mockTranslations}
      />,
    );

    expect(screen.getByTestId("icon-home")).toBeInTheDocument();
    expect(screen.getByTestId("icon-microscope")).toBeInTheDocument();
    expect(screen.getByTestId("icon-radio-receiver")).toBeInTheDocument();
    expect(screen.getByTestId("icon-code")).toBeInTheDocument();
  });

  it("renders translated sign-in text", () => {
    render(
      <AppSidebar
        user={null}
        locale="en-US"
        navigationData={mockNavigationData}
        translations={{ ...mockTranslations, signIn: "Log In" }}
      />,
    );

    expect(screen.getByText("Log In")).toBeInTheDocument();
  });
});
