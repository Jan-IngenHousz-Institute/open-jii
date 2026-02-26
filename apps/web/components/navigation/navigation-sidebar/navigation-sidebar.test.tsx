import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { AppSidebar } from "./navigation-sidebar";

// Mock NavItems child component
vi.mock("./nav-items", () => ({
  NavItems: ({ items }: { items: { title: string }[] }) => (
    <div data-testid="nav-items">
      {items.map((item, i) => (
        <div key={i}>{item.title}</div>
      ))}
    </div>
  ),
}));

const navigationData = {
  navDashboard: [{ title: "Dashboard", url: "/en/platform", icon: "Home", items: [] }],
  navExperiments: [
    { title: "Experiments", url: "/en/platform/experiments", icon: "Microscope", items: [] },
  ],
  navProtocols: [
    { title: "Protocols", url: "/en/platform/protocols", icon: "FileSliders", items: [] },
  ],
  navMacros: [{ title: "Macros", url: "/en/platform/macros", icon: "Code", items: [] }],
};

const translations = {
  openJII: "openJII",
  logoAlt: "openJII Logo",
  signIn: "Sign in",
  experimentsTitle: "Experiments",
  protocolTitle: "Protocols",
  macrosTitle: "Macros",
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
    for (const text of ["Dashboard", "Experiments", "Protocols", "Macros"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("renders logo", () => {
    renderSidebar();
    expect(screen.getAllByAltText("openJII Logo").length).toBeGreaterThan(0);
  });

  it("renders all navigation sections", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Experiments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Protocols/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Macros/i })).toBeInTheDocument();
  });
});
