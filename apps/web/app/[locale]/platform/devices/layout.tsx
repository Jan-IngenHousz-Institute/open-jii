"use client";

import {
  DevicesRegisterProvider,
  useDevicesRegister,
} from "@/components/iot-devices/devices-register-context";
import { PageContainer } from "@/components/page-container";
import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";
import { notFound, usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FEATURE_FLAGS } from "@repo/analytics";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export default function DevicesLayout({ children }: { children: React.ReactNode }) {
  // undefined while flags load; render nothing to avoid flashing a gated page
  const devicesEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.IOT_DEVICES);
  if (devicesEnabled === false) notFound();
  if (!devicesEnabled) return null;

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
  // Any deeper segment (/devices/<deviceId>) is an individual device detail,
  // which renders without the section header (it provides its own back link).
  const isDetail = pathname !== base && pathname !== `${base}/`;

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
          <h1 className="text-4xl font-bold text-gray-900">{t("iot.devices.title")}</h1>
          <p className="text-muted-foreground">{t("iot.devices.description")}</p>
        </div>
        <Button onClick={openRegister}>
          <Plus className="h-4 w-4" />
          {t("iot.devices.register")}
        </Button>
      </div>

      {children}
    </PageContainer>
  );
}
