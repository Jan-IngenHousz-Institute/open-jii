import { mainNavigation } from "@/components/navigation/navigation-config";
import * as React from "react";

import initTranslations from "@repo/i18n/server";

import { AppSidebar } from "../navigation-sidebar/navigation-sidebar";

export async function NavigationSidebarWrapper({
  locale,
  isCalibrationEnabled,
  ...props
}: Omit<React.ComponentProps<typeof AppSidebar>, "locale" | "navigationData" | "translations"> & {
  locale: string;
  isCalibrationEnabled: boolean;
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

  const { t: tIot } = await initTranslations({
    locale,
    namespaces: ["iot"],
  });

  // With calibration flagged off, Devices has only its overview left, so it goes back to
  // being a plain link rather than a group of one.
  const deviceChildren = mainNavigation.devices.children.filter(
    (child) => isCalibrationEnabled || child.url(locale) !== `/${locale}/platform/calibrations`,
  );
  const hasDeviceGroup = deviceChildren.length > 1;

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
    navDevices: [
      {
        title: tIot(mainNavigation.devices.titleKey),
        url: mainNavigation.devices.url(locale),
        icon: mainNavigation.devices.icon,
        isActive: true,
        navigable: !hasDeviceGroup,
        children: (hasDeviceGroup ? deviceChildren : []).map((child) => ({
          title: tNavigation(child.titleKey, { ns: child.namespace }),
          url: child.url(locale),
        })),
        items: [],
      },
    ],
    navWorkbooks: [
      {
        title: tNavigation(mainNavigation.workbooks.titleKey),
        url: mainNavigation.workbooks.url(locale),
        icon: mainNavigation.workbooks.icon,
        isActive: true,
        items: mainNavigation.workbooks.items.map((item) => ({
          title: tNavigation(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
    navOrganizations: [
      {
        title: tNavigation(mainNavigation.organizations.titleKey),
        url: mainNavigation.organizations.url(locale),
        icon: mainNavigation.organizations.icon,
        isActive: true,
        items: mainNavigation.organizations.items.map((item) => ({
          title: tNavigation(item.titleKey, { ns: item.namespace }),
          url: item.url(locale),
        })),
      },
    ],
    navLibrary: [
      {
        title: tNavigation(mainNavigation.library.titleKey),
        url: mainNavigation.library.url(locale),
        icon: mainNavigation.library.icon,
        navigable: false,
        children: mainNavigation.library.children.map((child) => ({
          title: tNavigation(child.titleKey, { ns: child.namespace }),
          url: child.url(locale),
          icon: child.icon,
          items: child.items?.map((item) => ({
            title: tNavigation(item.titleKey, { ns: item.namespace }),
            url: item.url(locale),
          })),
        })),
      },
    ],
  };

  const translations = {
    openJII: tCommon("navigation.openJII"),
    logoAlt: tCommon("common.logo"),
    signIn: tCommon("signIn"),
    experimentsTitle: tNavigation(mainNavigation.experiments.titleKey),
    libraryTitle: tNavigation(mainNavigation.library.titleKey),
    workbooksTitle: tNavigation(mainNavigation.workbooks.titleKey),
    organizationsTitle: tNavigation(mainNavigation.organizations.titleKey),
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
