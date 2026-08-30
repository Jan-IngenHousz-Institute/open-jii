import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { PlatformHeaderDetail, PlatformHeaderProvider } from "./platform-header-context";
import { SiteHeader } from "./site-header";

function renderHeader(pathname: string, detail?: { href: string; label: string }) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(
    <SidebarProvider>
      <PlatformHeaderProvider>
        <SiteHeader locale="en" />
        {detail && <PlatformHeaderDetail {...detail} />}
      </PlatformHeaderProvider>
    </SidebarProvider>,
  );
}

describe("SiteHeader", () => {
  it("renders the sidebar trigger inside a compact 48px header", () => {
    renderHeader("/en/platform/experiments");

    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeInTheDocument();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("h-12", "before:-top-2", "before:h-2", "before:bg-background");
    expect(header.className).not.toContain("rounded-t-xl");
    expect(header).toHaveStyle({
      top: "calc(var(--banner-offset, 0px) + var(--sidebar-inset-offset, 0px))",
    });
  });

  it("labels the current section", () => {
    renderHeader("/en/platform/experiments");

    expect(screen.getByRole("heading", { level: 1, name: "sidebar.experiments" })).toContainElement(
      screen.getByRole("link", { name: "sidebar.experiments" }),
    );
  });

  it("keeps the stable section label on detail routes", () => {
    renderHeader("/en/platform/macros/macro-123");

    expect(screen.getByRole("heading", { level: 1, name: "sidebar.macros" })).toBeInTheDocument();
  });

  it("shows a clickable section and entity title breadcrumb when the detail layout registers it", async () => {
    renderHeader("/en/platform/experiments/experiment-123", {
      href: "/en/platform/experiments/experiment-123",
      label: "Long-running canopy study",
    });

    expect(await screen.findByRole("navigation", { name: "navigation.breadcrumbs" })).toBeVisible();
    expect(screen.getByRole("link", { name: "sidebar.experiments" })).toHaveAttribute(
      "href",
      "/en/platform/experiments",
    );
    expect(screen.getByRole("link", { name: "Long-running canopy study" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("moves the create action into the header with a plus icon", () => {
    renderHeader("/en/platform/experiments");

    const create = screen.getByRole("link", { name: "experiments.create" });
    expect(create).toHaveAttribute("href", "/en/platform/experiments/new");
    expect(create.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps archive and transfer quick actions reachable as icon buttons on narrow screens", () => {
    renderHeader("/en/platform/experiments");

    const archive = screen.getByRole("link", { name: "experiments.viewArchived" });
    const transfer = screen.getByRole("link", { name: "transferRequest.title" });

    expect(archive).not.toHaveClass("hidden");
    expect(transfer).not.toHaveClass("hidden");
    expect(archive.querySelector("svg")).toBeInTheDocument();
    expect(transfer.querySelector("svg")).toBeInTheDocument();
  });

  it("uses plus icons for both device registration actions", () => {
    renderHeader("/en/platform/devices");

    const bulkRegister = screen.getByRole("button", { name: "iot.devices.bulkDialog.open" });
    const register = screen.getByRole("button", { name: "iot.devices.register" });

    expect(bulkRegister.querySelector("svg")).toBeInTheDocument();
    expect(register.querySelector("svg")).toBeInTheDocument();
  });

  it("labels the account section", () => {
    renderHeader("/en/platform/account");

    expect(screen.getByRole("heading", { level: 1, name: "auth.account" })).toBeInTheDocument();
  });

  it("falls back to the dashboard label at the platform root", () => {
    renderHeader("/en/platform");

    expect(screen.getByRole("heading", { level: 1, name: "dashboard.title" })).toBeInTheDocument();
  });

  it.each([
    ["/en/platform/experiments-archive/experiment-123", "experiments.archiveTitle"],
    ["/en/platform/transfer-request/history", "transferRequest.title"],
  ])("labels platform route trees that are not in the main sidebar", (pathname, label) => {
    renderHeader(pathname);

    expect(screen.getByRole("heading", { level: 1, name: label })).toBeInTheDocument();
    expect(screen.queryByText("dashboard.title")).not.toBeInTheDocument();
  });
});
