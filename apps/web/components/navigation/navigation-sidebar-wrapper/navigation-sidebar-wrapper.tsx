import { mainNavigation } from "@/components/navigation/navigation-config";
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
        items: mainNavigation.dashboard.items.map((item) => ({
          title: tCommon(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
    navExperiments: [
      {
        title: tNavigation(mainNavigation.experiments.titleKey),
        url: mainNavigation.experiments.url(locale),
        icon: mainNavigation.experiments.icon,
        isActive: true,
        items: mainNavigation.experiments.items.map((item) => ({
          title: tNavigation(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
    navProtocols: [
      {
        title: tNavigation(mainNavigation.protocols.titleKey),
        url: mainNavigation.protocols.url(locale),
        icon: mainNavigation.protocols.icon,
        isActive: true,
        items: mainNavigation.protocols.items.map((item) => ({
          title: tNavigation(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
    navMacros: [
      {
        title: tNavigation(mainNavigation.macros.titleKey),
        url: mainNavigation.macros.url(locale),
        icon: mainNavigation.macros.icon,
        isActive: true,
        items: mainNavigation.macros.items.map((item) => ({
          title: tNavigation(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
  };

  const translations = {
    openJII: tCommon("navigation.openJII"),
    logoAlt: tCommon("common.logo"),
    signIn: tCommon("signIn"),
    experimentsTitle: tNavigation(mainNavigation.experiments.titleKey),
    protocolTitle: tNavigation(mainNavigation.protocols.titleKey),
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
