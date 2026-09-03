import { COMMAND_PALETTE_OPEN_EVENT } from "@/components/shortcuts/shortcuts-root";
import { render, screen, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { AppSidebar } from "./navigation-sidebar";

// Mock NavItems child component
vi.mock("../nav-items/nav-items", () => ({
  NavItems: ({ items }: { items: { title: string; children?: { title: string }[] }[] }) => (
    <div data-testid="nav-items">
      {items.map((item, i) => (
        <div key={i}>
          {item.title}
          {item.children?.map((child, j) => <div key={j}>{child.title}</div>)}
        </div>
      ))}
    </div>
  ),
}));

const navigationData = {
  navDashboard: [{ title: "Dashboard", url: "/en/platform", icon: "LayoutDashboard", items: [] }],
  navExperiments: [
    { title: "Experiments", url: "/en/platform/experiments", icon: "Leaf", items: [] },
  ],
  navDevices: [{ title: "Devices", url: "/en/platform/devices", icon: "RadioReceiver", items: [] }],
  navWorkbooks: [
    { title: "Workbooks", url: "/en/platform/workbooks", icon: "BookOpen", items: [] },
  ],
  navOrganizations: [
    { title: "Organizations", url: "/en/platform/organizations", icon: "Users", items: [] },
  ],
  navLibrary: [
    {
      title: "Library",
      url: "/en/platform/protocols",
      icon: "Library",
      navigable: false,
      items: [],
      children: [
        { title: "Protocols", url: "/en/platform/protocols", icon: "FileSliders", items: [] },
        { title: "Macros", url: "/en/platform/macros", icon: "Code", items: [] },
      ],
    },
  ],
};

const translations = {
  openJII: "openJII",
  logoAlt: "openJII Logo",
  signIn: "Sign in",
  experimentsTitle: "Experiments",
  libraryTitle: "Library",
  workbooksTitle: "Workbooks",
  organizationsTitle: "Organizations",
};

function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar
        locale="en"
        navigationData={navigationData}
        translations={translations}
        user={{ id: "user-1", email: "test@example.com" }}
      />
    </SidebarProvider>,
  );
}

describe("AppSidebar", () => {
  it("renders navigation items", () => {
    renderSidebar();
    for (const text of ["Dashboard", "Experiments", "Workbooks", "Protocols", "Macros"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("renders logo", () => {
    renderSidebar();
    expect(screen.getAllByAltText("openJII Logo").length).toBeGreaterThan(0);
  });

  it("renders all navigation sections", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(screen.getByText("Workbooks")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Protocols")).toBeInTheDocument();
    expect(screen.getByText("Macros")).toBeInTheDocument();
  });

  it("opens the command palette from the sidebar search row", () => {
    const handler = vi.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
    renderSidebar();
    fireEvent.click(screen.getByLabelText("Open command palette"));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
  });

  it("renders as the inset, offcanvas sidebar (dashboard-01 composition)", () => {
    const { container } = renderSidebar();
    expect(container.querySelector('[data-variant="inset"]')).not.toBeNull();
  });

  it("relocates the topbar utilities into the sidebar", () => {
    const { container } = renderSidebar();

    // Secondary navigation rows near the bottom of the scroll area.
    expect(screen.getByRole("button", { name: /Activity/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "whatsNew.navLabel" })).toBeInTheDocument();

    // Branded docs entry opening in a new tab.
    const docsLink = screen.getByRole("link", { name: /navigation.documentation/i });
    expect(docsLink).toHaveAttribute("target", "_blank");
    expect(docsLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(docsLink).toHaveTextContent("navigation.documentation");
    expect(docsLink.querySelector("svg")).toBeInTheDocument();
    expect(docsLink.querySelector("img")).not.toBeInTheDocument();

    // Footer account menu and the one-click, icon-only theme control. Its
    // accessible action follows the resolved theme.
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    const themeToggle = screen.getByRole("button", {
      name: /common\.switchTo(Dark|Light)Mode/,
    });
    expect(themeToggle).toBeInTheDocument();
    expect(themeToggle).toHaveClass("shrink-0");
    expect(themeToggle).not.toHaveTextContent("common.toggleTheme");

    const footer = container.querySelector('[data-sidebar="footer"]');
    const footerRow = footer?.firstElementChild;
    expect(footerRow).toContainElement(themeToggle);
    expect(footerRow).toContainElement(screen.getByText("test@example.com"));
    expect(themeToggle.nextElementSibling).toContainElement(screen.getByText("test@example.com"));
  });

  it("removes the redundant in-sidebar collapse control", () => {
    const { container } = renderSidebar();

    expect(container.querySelector('[data-sidebar="trigger"]')).toBeNull();
  });

  it("aligns every secondary utility as the same compact sidebar row", () => {
    renderSidebar();

    const rows = [
      screen.getByRole("button", { name: /Activity/i }),
      screen.getByRole("button", { name: "whatsNew.navLabel" }),
      screen.getByRole("link", { name: /navigation.documentation/i }),
    ];

    for (const row of rows) {
      expect(row).toHaveClass("h-9", "w-full", "gap-2", "rounded-lg", "px-2", "py-0");
    }
  });
});
