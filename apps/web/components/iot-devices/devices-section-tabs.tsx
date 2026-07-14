"use client";

import { useTranslation } from "@repo/i18n";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

import { ComingSoonPanel } from "./coming-soon-panel";
import { DevicesOverview } from "./devices-overview";
import { IotDevicesTableView } from "./iot-devices-table-view";

export function DevicesSectionTabs() {
  const { t } = useTranslation("iot");

  return (
    <NavTabs defaultValue="devices" className="space-y-6">
      <NavTabsList>
        <NavTabsTrigger value="overview">{t("iot.devices.sections.overview")}</NavTabsTrigger>
        <NavTabsTrigger value="devices">{t("iot.devices.sections.devices")}</NavTabsTrigger>
        <NavTabsTrigger value="groups">{t("iot.devices.sections.groups")}</NavTabsTrigger>
        <NavTabsTrigger value="onboarding">{t("iot.devices.sections.onboarding")}</NavTabsTrigger>
        <NavTabsTrigger value="monitoring">{t("iot.devices.sections.monitoring")}</NavTabsTrigger>
      </NavTabsList>

      <NavTabsContent value="overview">
        <DevicesOverview />
      </NavTabsContent>
      <NavTabsContent value="devices">
        <IotDevicesTableView />
      </NavTabsContent>
      <NavTabsContent value="groups">
        <ComingSoonPanel description={t("iot.devices.comingSoon.groups")} />
      </NavTabsContent>
      <NavTabsContent value="onboarding">
        <ComingSoonPanel description={t("iot.devices.comingSoon.onboarding")} />
      </NavTabsContent>
      <NavTabsContent value="monitoring">
        <ComingSoonPanel description={t("iot.devices.comingSoon.monitoring")} />
      </NavTabsContent>
    </NavTabs>
  );
}
