import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { AppSidebar } from "./navigation-sidebar";

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

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/platform",
}));

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

// Mock useSidebar
const mockUseSidebar = vi.fn(() => ({
  state: "expanded" as "expanded" | "collapsed",
  toggleSidebar: vi.fn(),
  open: true,
  setOpen: vi.fn(),
  openMobile: false,
  setOpenMobile: vi.fn(),
  isMobile: false,
}));

vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components");
  return {
    ...actual,
    useSidebar: () => mockUseSidebar(),
  };
});

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
    navProtocols: [
      { title: "Protocols", url: "/en/platform/protocols", icon: "FileSliders", items: [] },
    ],
    navMacros: [{ title: "Macros", url: "/en/platform/macros", icon: "Code", items: [] }],
  };

  const mockTranslations = {
    openJII: "openJII",
    logoAlt: "openJII Logo",
    signIn: "Sign in",
    experimentsTitle: "Experiments",
    protocolTitle: "Protocols",
    macrosTitle: "Macros",
  };

  beforeEach(() => {
    mockUseSidebar.mockReturnValue({
      state: "expanded",
      toggleSidebar: vi.fn(),
      open: true,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
    });
  });

  it("renders navigation items correctly", () => {
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    // Check that navigation links are rendered
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Experiments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Protocols/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Macros/i })).toBeInTheDocument();
  });

  it("renders logo", () => {
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    const logos = screen.getAllByAltText("openJII Logo");
    expect(logos.length).toBeGreaterThan(0);
  });

  it("renders all navigation sections", () => {
    render(
      <SidebarProvider>
        <AppSidebar
          locale="en"
          navigationData={mockNavigationData}
          translations={mockTranslations}
        />
      </SidebarProvider>,
    );

    // Check that navigation items are rendered by looking for the text content
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(screen.getByText("Protocols")).toBeInTheDocument();
    expect(screen.getByText("Macros")).toBeInTheDocument();
  });

  // Search functionality has been temporarily disabled
  // it("renders search button that tests click handler logic", () => {
  //   render(
  //     <SidebarProvider>
  //       <AppSidebar
  //         locale="en"
  //         navigationData={mockNavigationData}
  //         translations={mockTranslations}
  //       />
  //     </SidebarProvider>,
  //   );

  //   // Find the search input (lines 54-61 test the click handler on the button)
  //   // The search functionality is rendered with an input
  //   const searchInput = screen.getByPlaceholderText("Search by keyword...");
  //   expect(searchInput).toBeInTheDocument();
  // });

  // it("renders search icon button for collapsed state", () => {
  //   render(
  //     <SidebarProvider>
  //       <AppSidebar
  //         locale="en"
  //         navigationData={mockNavigationData}
  //         translations={mockTranslations}
  //       />
  //     </SidebarProvider>,
  //   );

  //   // Lines 54-61: handleSearchClick checks if state === 'collapsed'
  //   // In expanded state (default), the function exists but doesn't toggle
  //   // This test covers both branches of the if condition
  //   const searchInput = screen.getByPlaceholderText("Search by keyword...");
  //   expect(searchInput).toBeInTheDocument();

  //   // The input ref and setTimeout logic is tested by the component rendering
  //   expect(searchInput).toHaveAttribute("type", "text");
  // });

  // it("search input ref is attached correctly", () => {
  //   render(
  //     <SidebarProvider>
  //       <AppSidebar
  //         locale="en"
  //         navigationData={mockNavigationData}
  //         translations={mockTranslations}
  //       />
  //     </SidebarProvider>,
  //   );

  //   // Lines 54-61: The handleSearchClick function with if (state === "collapsed")
  //   // This ensures the searchInputRef.current?.focus() line is covered
  //   const searchInput = screen.getByPlaceholderText("Search by keyword...");
  //   expect(searchInput).toBeInTheDocument();

  //   // Focus the input to ensure the ref is working
  //   searchInput.focus();
  //   expect(searchInput).toHaveFocus();
  // });

  // it("calls toggleSidebar and focuses search input when search is clicked in collapsed state", async () => {
  //   const mockToggleSidebar = vi.fn();
  //   mockUseSidebar.mockReturnValue({
  //     state: "collapsed",
  //     toggleSidebar: mockToggleSidebar,
  //     open: false,
  //     setOpen: vi.fn(),
  //     openMobile: false,
  //     setOpenMobile: vi.fn(),
  //     isMobile: false,
  //   });

  //   render(
  //     <SidebarProvider>
  //       <AppSidebar
  //         locale="en"
  //         navigationData={mockNavigationData}
  //         translations={mockTranslations}
  //       />
  //     </SidebarProvider>,
  //   );

  //   // In collapsed state, the search icon button should be visible
  //   // Find the button that triggers handleSearchClick
  //   const buttons = screen.getAllByRole("button");
  //   // The search button is the one with the search icon (hidden class will be removed in collapsed state)
  //   const searchButton = buttons.find((button) =>
  //     button.className.includes("group-data-[collapsible=icon]:flex"),
  //   );

  //   if (searchButton) {
  //     await userEvent.click(searchButton);
  //     expect(mockToggleSidebar).toHaveBeenCalled();

  //     // Wait for the setTimeout to execute (200ms delay in the code)
  //     await waitFor(
  //       () => {
  //         const searchInput = screen.getByPlaceholderText("Search by keyword...");
  //         expect(document.activeElement).toBe(searchInput);
  //       },
  //       { timeout: 500 },
  //     );
  //   }
  // });
});
