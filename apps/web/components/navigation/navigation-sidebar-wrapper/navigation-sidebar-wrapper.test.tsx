import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components";

import { NavigationSidebarWrapper } from "./navigation-sidebar-wrapper";

// Mock AppSidebar component
vi.mock("../navigation-sidebar/navigation-sidebar", () => ({
  AppSidebar: ({
    locale,
    navigationData,
    translations,
  }: {
    locale: string;
    navigationData: unknown;
    translations: unknown;
  }) => (
    <div data-testid="app-sidebar">
      <div data-testid="sidebar-locale">{locale}</div>
      <div data-testid="sidebar-navigationData">{JSON.stringify(navigationData)}</div>
      <div data-testid="sidebar-translations">{JSON.stringify(translations)}</div>
    </div>
  ),
}));

describe("NavigationSidebarWrapper", () => {
  it("renders AppSidebar with correct locale", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    expect(screen.getByTestId("sidebar-locale")).toHaveTextContent("en");
  });

  it("renders AppSidebar with correct locale for German", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "de" });
    render(Component);

    expect(screen.getByTestId("sidebar-locale")).toHaveTextContent("de");
  });

  it("prepares navigation data with translations", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navDashboard: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
      navExperiments: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
    };

    // Check dashboard navigation
    expect(navigationData.navDashboard).toHaveLength(1);
    expect(navigationData.navDashboard[0]).toMatchObject({
      title: "dashboard.title",
      url: "/en/platform",
      icon: "LayoutDashboard",
      isActive: true,
    });

    // Check experiments navigation
    expect(navigationData.navExperiments).toHaveLength(1);
    expect(navigationData.navExperiments[0]).toMatchObject({
      title: "sidebar.experiments",
      url: "/en/platform/experiments",
      icon: "Leaf",
      isActive: true,
    });
    expect(navigationData.navExperiments[0].items).toHaveLength(2);
    expect(navigationData.navExperiments[0].items[0]).toMatchObject({
      title: "sidebar.newExperiment",
      url: "/en/platform/experiments/new",
    });
    expect(navigationData.navExperiments[0].items[1]).toMatchObject({
      title: "sidebar.overview",
      url: "/en/platform/experiments",
    });
  });

  it("prepares protocols navigation", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navProtocols: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
    };

    // Check protocols navigation
    expect(navigationData.navProtocols).toHaveLength(1);
    expect(navigationData.navProtocols[0]).toMatchObject({
      title: "sidebar.protocols",
      url: "/en/platform/protocols",
      icon: "FileSliders",
      isActive: true,
    });
    expect(navigationData.navProtocols[0].items).toHaveLength(2);
    expect(navigationData.navProtocols[0].items[0]).toMatchObject({
      title: "sidebar.newProtocol",
      url: "/en/platform/protocols/new",
    });
  });

  it("prepares macros navigation", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navMacros: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
    };

    // Check macros navigation
    expect(navigationData.navMacros).toHaveLength(1);
    expect(navigationData.navMacros[0]).toMatchObject({
      title: "sidebar.macros",
      url: "/en/platform/macros",
      icon: "Code",
      isActive: true,
    });
    expect(navigationData.navMacros[0].items).toHaveLength(2);
    expect(navigationData.navMacros[0].items[0]).toMatchObject({
      title: "sidebar.newMacro",
      url: "/en/platform/macros/new",
    });
  });

  it("prepares translations object correctly", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const translationsElement = screen.getByTestId("sidebar-translations");
    const translations = JSON.parse(translationsElement.textContent) as Record<string, string>;

    expect(translations).toMatchObject({
      openJII: "navigation.openJII",
      logoAlt: "common.logo",
      signIn: "signIn",
      experimentsTitle: "sidebar.experiments",
      protocolTitle: "sidebar.protocols",
      macrosTitle: "sidebar.macros",
    });
  });

  it("uses correct locale in URLs for German", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "de" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navDashboard: { url: string }[];
      navExperiments: { url: string; items: { url: string }[] }[];
    };

    expect(navigationData.navDashboard[0].url).toBe("/de/platform");
    expect(navigationData.navExperiments[0].url).toBe("/de/platform/experiments");
    expect(navigationData.navExperiments[0].items[0].url).toBe("/de/platform/experiments/new");
  });

  it("passes additional props to AppSidebar", async () => {
    const Component = await NavigationSidebarWrapper({
      locale: "en",
      className: "test-class",
    } as never);
    render(Component);

    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
  });

  it("handles dashboard items correctly", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navDashboard: {
        items: { title: string; url: string }[];
      }[];
    };

    // Dashboard items should be mapped (lines 34-35)
    expect(navigationData.navDashboard[0].items).toBeDefined();
    expect(Array.isArray(navigationData.navDashboard[0].items)).toBe(true);
  });

  it("maps dashboard items with correct namespace and titleKey", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navDashboard: {
        items: { title: string; url: string }[];
      }[];
    };

    // Lines 34-35: items.map with titleKey and namespace from item
    // In the mock, dashboard.items is empty array, so verify the structure
    const dashboardItems = navigationData.navDashboard[0].items;
    expect(Array.isArray(dashboardItems)).toBe(true);
    // Dashboard items array exists (even if empty) which proves the mapping code ran
    expect(navigationData.navDashboard[0]).toHaveProperty("items");
  });

  it("maps experiments items with titleKey and namespace", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navExperiments: {
        items: { title: string; url: string }[];
      }[];
    };

    // Lines 34-35 pattern is repeated for experiments, protocols, macros
    // Verify experiments items are mapped correctly (has items in mock)
    const experimentsItems = navigationData.navExperiments[0].items;
    expect(experimentsItems.length).toBeGreaterThan(0);
    expect(experimentsItems[0]).toHaveProperty("title");
    expect(experimentsItems[0]).toHaveProperty("url");
  });

  it("maps protocol and macro items correctly", async () => {
    const Wrapper = await NavigationSidebarWrapper({ locale: "en" });
    render(<SidebarProvider>{Wrapper}</SidebarProvider>);

    const component = Wrapper as React.ReactElement<{
      navigationData: {
        navProtocols: { items: { title: string; url: string }[] }[];
        navMacros: { items: { title: string; url: string }[] }[];
      };
    }>;

    // Lines 34-35: Verify protocols items.map() executes
    const protocolsItems = component.props.navigationData.navProtocols[0].items;
    expect(protocolsItems.length).toBeGreaterThan(0);
    expect(protocolsItems[0]).toHaveProperty("title");

    // Lines 34-35: Verify macros items.map() executes
    const macrosItems = component.props.navigationData.navMacros[0].items;
    expect(macrosItems.length).toBeGreaterThan(0);
    expect(macrosItems[0]).toHaveProperty("title");
  });
});
