import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { NavigationSidebarWrapper } from "./navigation-sidebar-wrapper";

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

// Mock @repo/i18n/server
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => {
    const t = (key: string) => key;
    return Promise.resolve({ t });
  }),
}));

// Mock navigation-config
vi.mock("@/components/navigation/navigation-config", () => ({
  mainNavigation: {
    dashboard: {
      titleKey: "navigation.dashboard",
      url: (locale: string) => `/${locale}/platform`,
      icon: "Home",
    },
    experiments: {
      titleKey: "sidebar.experiments",
      url: (locale: string) => `/${locale}/platform/experiments`,
      icon: "Microscope",
    },
    protocols: {
      titleKey: "sidebar.protocols",
      url: (locale: string) => `/${locale}/platform/protocols`,
      icon: "FileSliders",
    },
    macros: {
      titleKey: "sidebar.macros",
      url: (locale: string) => `/${locale}/platform/macros`,
      icon: "Code",
    },
  },
  createNavigation: {
    buttonKey: "navigation.create",
    items: [
      {
        titleKey: "navigation.protocol",
        url: (locale: string) => `/${locale}/platform/protocols/new`,
        namespace: "common",
      },
      {
        titleKey: "navigation.experiment",
        url: (locale: string) => `/${locale}/platform/experiments/new`,
        namespace: "navigation",
      },
      {
        titleKey: "navigation.macro",
        url: (locale: string) => `/${locale}/platform/macros/new`,
        namespace: "navigation",
      },
    ],
  },
}));

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
    const navigationData = JSON.parse(navigationDataElement.textContent ?? "{}") as {
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
      title: "navigation.dashboard",
      url: "/en/platform",
      icon: "Home",
      isActive: true,
    });

    // Check experiments navigation
    expect(navigationData.navExperiments).toHaveLength(1);
    expect(navigationData.navExperiments[0]).toMatchObject({
      title: "sidebar.experiments",
      url: "/en/platform/experiments",
      icon: "Microscope",
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

  it("prepares hardware navigation with protocols", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent ?? "{}") as {
      navHardware: {
        title: string;
        url: string;
        icon: string;
        isActive: boolean;
        items: { title: string; url: string }[];
      }[];
    };

    // Check protocols navigation
    expect(navigationData.navHardware).toHaveLength(1);
    expect(navigationData.navHardware[0]).toMatchObject({
      title: "sidebar.protocols",
      url: "/en/platform/protocols",
      icon: "FileSliders",
      isActive: true,
    });
    expect(navigationData.navHardware[0].items).toHaveLength(2);
    expect(navigationData.navHardware[0].items[0]).toMatchObject({
      title: "sidebar.newProtocol",
      url: "/en/platform/protocols/new",
    });
  });

  it("prepares macros navigation", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "en" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent ?? "{}") as {
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
    const translations = JSON.parse(translationsElement.textContent ?? "{}") as Record<
      string,
      string
    >;

    expect(translations).toMatchObject({
      openJII: "navigation.openJII",
      logoAlt: "common.logo",
      signIn: "signIn",
      create: "navigation.create",
      protocol: "navigation.protocol",
      experiment: "navigation.experiment",
      macro: "navigation.macro",
      experimentsTitle: "sidebar.experiments",
      hardwareTitle: "sidebar.hardware",
      macrosTitle: "sidebar.macros",
    });
  });

  it("uses correct locale in URLs for German", async () => {
    const Component = await NavigationSidebarWrapper({ locale: "de" });
    render(Component);

    const navigationDataElement = screen.getByTestId("sidebar-navigationData");
    const navigationData = JSON.parse(navigationDataElement.textContent ?? "{}") as {
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
});
