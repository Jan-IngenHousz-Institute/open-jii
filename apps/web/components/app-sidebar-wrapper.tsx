import * as React from "react";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { AppSidebar } from "./app-sidebar";

export async function AppSidebarWrapper({
  locale,
  user,
  ...props
}: Omit<React.ComponentProps<typeof AppSidebar>, "locale" | "navigationData" | "translations"> & {
  locale: Locale;
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

  // Prepare navigation data server-side
  const navigationData = {
    navDashboard: [
      {
        title: tCommon("dashboard.title"),
        url: `/${locale}/platform`,
        icon: "Home",
        isActive: true,
        items: [],
      },
    ],
    navExperiments: [
      {
        title: tNavigation("sidebar.experiments"),
        url: `/${locale}/platform/experiments`,
        icon: "Microscope",
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
          {
            title: tNavigation("sidebar.archive"),
            url: `/${locale}/platform/experiments-archive`,
          },
        ],
      },
    ],
    // experiments archive has been moved into navExperiments as a subitem
    navHardware: [
      {
        title: tNavigation("sidebar.protocols"),
        url: `/${locale}/platform/protocols`,
        icon: "FileSliders",
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
        title: tNavigation("sidebar.macros"),
        url: `/${locale}/platform/macros`,
        icon: "Code",
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
    experimentsTitle: tNavigation("sidebar.experiments"),
    experimentsArchiveTitle: tNavigation("sidebar.experimentsArchive"),
    hardwareTitle: tNavigation("sidebar.hardware"),
    macrosTitle: tNavigation("sidebar.macros"),
  };

  return (
    <AppSidebar
      user={user}
      locale={locale}
      navigationData={navigationData}
      translations={translations}
      {...props}
    />
  );
}
