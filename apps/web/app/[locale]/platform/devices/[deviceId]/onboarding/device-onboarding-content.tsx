"use client";

import { DeviceOnboardingPanel } from "@/components/iot-devices/device-onboarding-panel";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface DeviceOnboardingPageProps {
  params: Promise<{ deviceId: string }>;
}

/** Manage-gated onboarding: binding and config issuance require device manage. */
export default function DeviceOnboardingPage({ params }: DeviceOnboardingPageProps) {
  const { deviceId } = use(params);
  const { data } = useIotDevice(deviceId);
  const router = useRouter();
  const locale = useLocale();

  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  // Only once the capabilities are actually in hand: "not yet known" must not read
  // as "nothing to show here".
  const hasNoSurface = !!data && !data.capabilities.canManage;

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) router.replace(detailPath);
  }, [hasNoSurface, detailPath, router]);

  if (!data?.capabilities.canManage) return null;

  // Keyed so an issued config never survives a device-to-device navigation.
  return <DeviceOnboardingPanel key={data.id} device={data} />;
}
