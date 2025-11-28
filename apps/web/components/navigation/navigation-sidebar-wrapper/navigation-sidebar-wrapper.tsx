import { mainNavigation, createNavigation } from "@/components/navigation/navigation-config";
import * as React from "react";

import initTranslations from "@repo/i18n/server";

import { AppSidebar } from "../navigation-sidebar/navigation-sidebar";

export async function NavigationSidebarWrapper({
  locale,
  ...props
}: Omit<React.ComponentProps<typeof AppSidebar>, "locale" | "navigationData" | "translations"> & {
  locale: string;
}) {
  // Get translations server-side
  const { t: tNavigation } = await initTranslations({
    locale,
    namespaces: ["navigation"],
  });

  const { t: tCommon } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  // Prepare navigation data server-side using config
  const navigationData = {
    navDashboard: [
      {
        title: tCommon(mainNavigation.dashboard.titleKey),
        url: mainNavigation.dashboard.url(locale),
        icon: mainNavigation.dashboard.icon,
        isActive: true,
        items: [],
      },
    ],
    navExperiments: [
      {
        title: tNavigation(mainNavigation.experiments.titleKey),
        url: mainNavigation.experiments.url(locale),
        icon: mainNavigation.experiments.icon,
        isActive: true,
        items: [
          {
            title: tNavigation("sidebar.newExperiment"),
            url: `/${locale}/platform/experiments/new`,
          },
          {
            title: tNavigation("sidebar.overview"),
            url: `/${locale}/platform/experiments`,
          },
        ],
      },
    ],
    navHardware: [
      {
        title: tNavigation(mainNavigation.protocols.titleKey),
        url: mainNavigation.protocols.url(locale),
        icon: mainNavigation.protocols.icon,
        isActive: true,
        items: [
          {
            title: tNavigation("sidebar.newProtocol"),
            url: `/${locale}/platform/protocols/new`,
          },
          {
            title: tNavigation("sidebar.overview"),
            url: `/${locale}/platform/protocols`,
          },
        ],
      },
    ],
    navMacros: [
      {
        title: tNavigation(mainNavigation.macros.titleKey),
        url: mainNavigation.macros.url(locale),
        icon: mainNavigation.macros.icon,
        isActive: true,
        items: [
          {
            title: tNavigation("sidebar.newMacro"),
            url: `/${locale}/platform/macros/new`,
          },
          {
            title: tNavigation("sidebar.overview"),
            url: `/${locale}/platform/macros`,
          },
        ],
      },
    ],
  };

  const translations = {
    openJII: tCommon("navigation.openJII"),
    logoAlt: tCommon("common.logo"),
    signIn: tCommon("signIn"),
    create: tCommon(createNavigation.buttonKey),
    protocol: tCommon(createNavigation.items[0].titleKey),
    experiment: tNavigation(createNavigation.items[1].titleKey),
    macro: tNavigation(createNavigation.items[2].titleKey),
    experimentsTitle: tNavigation(mainNavigation.experiments.titleKey),
    hardwareTitle: tNavigation("sidebar.hardware"),
    macrosTitle: tNavigation(mainNavigation.macros.titleKey),
  };

  return (
    <AppSidebar
      locale={locale}
      navigationData={navigationData}
      translations={translations}
      {...props}
    />
  );
}
