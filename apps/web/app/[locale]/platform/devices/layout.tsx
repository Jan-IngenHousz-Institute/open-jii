"use client";

import { BulkRegisterIotDevicesDialog } from "@/components/iot-devices/bulk-register-iot-devices-dialog";
import {
  DevicesRegisterProvider,
  useDevicesRegister,
} from "@/components/iot-devices/devices-register-context";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";
import { notFound, usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";

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
  const [bulkOpen, setBulkOpen] = useState(false);

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
      <PageHeader
        title={t("iot.devices.title")}
        description={t("iot.devices.description")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setBulkOpen(true);
              }}
            >
              {t("iot.devices.bulkDialog.open")}
            </Button>
            <Button onClick={openRegister}>
              <Plus className="h-4 w-4" />
              {t("iot.devices.register")}
            </Button>
          </>
        }
      />

      {children}

      <BulkRegisterIotDevicesDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </PageContainer>
  );
}
