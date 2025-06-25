import * as React from "react";

import { auth } from "@repo/auth/next";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { AppSidebar } from "./app-sidebar";

export async function AppSidebarWrapper({
  locale,
  ...props
}: Omit<
  React.ComponentProps<typeof AppSidebar>,
  "user" | "locale" | "navigationData" | "translations"
> & {
  locale: Locale;
}) {
  const session = await auth();

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
        url: "#",
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
      {
        title: tNavigation("sidebar.archive"),
        url: "#",
        icon: "Archive",
        items: [
          {
            title: tNavigation("sidebar.public"),
            url: "#",
          },
          {
            title: tNavigation("sidebar.private"),
            url: "#",
          },
        ],
      },
    ],
    navHardware: [
      {
        title: tNavigation("sidebar.sensors"),
        url: "#",
        icon: "Webcam",
        items: [
          {
            title: tNavigation("sidebar.multispeq"),
            url: "#",
          },
        ],
      },
      {
        title: tNavigation("sidebar.protocols"),
        url: "#",
        icon: "FileSliders",
        items: [
          {
            title: tNavigation("sidebar.protocol1"),
            url: "#",
          },
        ],
      },
      {
        title: tNavigation("sidebar.otherDevices"),
        url: "#",
        icon: "RadioReceiver",
        items: [
          {
            title: tNavigation("sidebar.otherDevice1"),
            url: "#",
          },
        ],
      },
    ],
  };

  const translations = {
    openJII: tNavigation("navigation.openJII"),
    logoAlt: tCommon("common.logo"),
    signIn: tCommon("signIn"),
    experimentsTitle: tNavigation("sidebar.experiments"),
    hardwareTitle: tNavigation("sidebar.hardware"),
  };

  return (
    <AppSidebar
      user={session?.user}
      locale={locale}
      navigationData={navigationData}
      translations={translations}
      {...props}
    />
  );
}
