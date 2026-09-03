"use client";

import { DevicesRegisterProvider } from "@/components/iot-devices/devices-register-context";
import { PageContainer } from "@/components/page-container";
import { useLocale } from "@/hooks/useLocale";
import { notFound, usePathname } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FEATURE_FLAGS } from "@repo/analytics";

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
      {children}
    </PageContainer>
  );
}
