import { render, screen } from "@/test/test-utils";
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
  navWorkbooks: [
    { title: "Workbooks", url: "/en/platform/workbooks", icon: "BookOpen", items: [] },
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
};

function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar locale="en" navigationData={navigationData} translations={translations} />
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
});
