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
        ],
      },
    ],
    navHardware: [
      {
        title: tNavigation("sidebar.protocols"),
        url: `/${locale}/platform/protocols`,
        icon: "FileSliders",
        items: [
          {
            title: tNavigation("sidebar.overview"),
            url: `/${locale}/platform/protocols`,
          },
          {
            title: tNavigation("sidebar.newProtocol"),
            url: `/${locale}/platform/protocols/new`,
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
    hardwareTitle: tNavigation("sidebar.hardware"),
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
