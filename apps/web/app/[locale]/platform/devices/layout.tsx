"use client";

import {
  DevicesRegisterProvider,
  useDevicesRegister,
} from "@/components/iot-devices/devices-register-context";
import { PageContainer } from "@/components/page-container";
import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { NavTabs, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

export default function DevicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DevicesRegisterProvider>
      <DevicesLayoutInner>{children}</DevicesLayoutInner>
    </DevicesRegisterProvider>
  );
}

function DevicesLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { t } = useTranslation("iot");
  const { openRegister } = useDevicesRegister();

  const base = `/${locale}/platform/devices`;
  const isAll = pathname.startsWith(`${base}/all`);
  const isOverview = pathname === base || pathname === `${base}/`;
  // Any other /devices/<segment> is an individual device detail, which renders
  // without the section header/tabs (it provides its own back link).
  const isDetail = !isAll && !isOverview;

  if (isDetail) {
    return (
      <PageContainer width="fluid" className="space-y-6">
        {children}
      </PageContainer>
    );
  }

  return (
    <PageContainer width="fluid" className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("devices.title")}</h1>
          <p className="text-muted-foreground">{t("devices.description")}</p>
        </div>
        <Button onClick={openRegister}>
          <Plus className="h-4 w-4" />
          {t("devices.register")}
        </Button>
      </div>

      <NavTabs value={isAll ? "all" : "overview"} className="flex w-full flex-1 flex-col">
        <NavTabsList>
          <NavTabsTrigger value="overview" asChild>
            <Link href={base}>{t("devices.tabs.overview")}</Link>
          </NavTabsTrigger>
          <NavTabsTrigger value="all" asChild>
            <Link href={`${base}/all`}>{t("devices.tabs.devices")}</Link>
          </NavTabsTrigger>
        </NavTabsList>

        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </NavTabs>
    </PageContainer>
  );
}
