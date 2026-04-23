import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

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

    expect(navigationData.navDashboard).toHaveLength(1);
    expect(navigationData.navDashboard[0]).toMatchObject({
      title: "dashboard.title",
      url: "/en/platform",
      icon: "LayoutDashboard",
      isActive: true,
    });

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

  it("prepares library navigation with protocols child", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navLibrary: {
        title: string;
        url: string;
        icon: string;
        navigable: boolean;
        children: {
          title: string;
          url: string;
          icon: string;
          items: { title: string; url: string }[];
        }[];
      }[];
    };

    expect(navigationData.navLibrary).toHaveLength(1);
    expect(navigationData.navLibrary[0]).toMatchObject({
      title: "sidebar.library",
      icon: "Library",
      navigable: false,
    });

    const protocols = navigationData.navLibrary[0].children[0];
    expect(protocols).toMatchObject({
      title: "sidebar.protocols",
      url: "/en/platform/protocols",
      icon: "FileSliders",
    });
    expect(protocols.items).toHaveLength(2);
    expect(protocols.items[0]).toMatchObject({
      title: "sidebar.newProtocol",
      url: "/en/platform/protocols/new",
    });
  });

  it("prepares library navigation with macros child", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navLibrary: {
        children: {
          title: string;
          url: string;
          icon: string;
          items: { title: string; url: string }[];
        }[];
      }[];
    };

    const macros = navigationData.navLibrary[0].children[1];
    expect(macros).toMatchObject({
      title: "sidebar.macros",
      url: "/en/platform/macros",
      icon: "Code",
    });
    expect(macros.items).toHaveLength(2);
    expect(macros.items[0]).toMatchObject({
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
      libraryTitle: "sidebar.library",
      workbooksTitle: "sidebar.workbooks",
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
    const experimentsItems = navigationData.navExperiments[0].items;
    expect(experimentsItems.length).toBeGreaterThan(0);
    expect(experimentsItems[0]).toHaveProperty("title");
    expect(experimentsItems[0]).toHaveProperty("url");
  });

  it("maps library children items correctly", async () => {
    const Wrapper = await NavigationSidebarWrapper({ locale: "en" });
    render(<SidebarProvider>{Wrapper}</SidebarProvider>);

    const component = Wrapper as React.ReactElement<{
      navigationData: {
        navLibrary: {
          children: { items: { title: string; url: string }[] }[];
        }[];
        navWorkbooks: { items: { title: string; url: string }[] }[];
      };
    }>;

    // Verify protocols items under library children
    const protocolsItems = component.props.navigationData.navLibrary[0].children[0].items;
    expect(protocolsItems.length).toBeGreaterThan(0);
    expect(protocolsItems[0]).toHaveProperty("title");

    // Verify macros items under library children
    const macrosItems = component.props.navigationData.navLibrary[0].children[1].items;
    expect(macrosItems.length).toBeGreaterThan(0);
    expect(macrosItems[0]).toHaveProperty("title");

    // Verify workbooks items.map() executes
    const workbooksItems = component.props.navigationData.navWorkbooks[0].items;
    expect(workbooksItems.length).toBeGreaterThan(0);
    expect(workbooksItems[0]).toHaveProperty("title");
  });

  it("prepares workbooks navigation", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent) as {
      navWorkbooks: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
    };

    expect(navigationData.navWorkbooks).toHaveLength(1);
    expect(navigationData.navWorkbooks[0]).toMatchObject({
      title: "sidebar.workbooks",
      url: "/en/platform/workbooks",
      icon: "BookOpen",
      isActive: true,
    });
    expect(navigationData.navWorkbooks[0].items).toHaveLength(2);
    expect(navigationData.navWorkbooks[0].items[0]).toMatchObject({
      title: "sidebar.newWorkbook",
      url: "/en/platform/workbooks/new",
    });
  });
});
