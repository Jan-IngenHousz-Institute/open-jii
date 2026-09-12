"use client";

import { DeviceOnboardingPanel } from "@/components/iot-devices/device-onboarding-panel";
import { ResourceAccessDenied } from "@/components/shared/resource-access-denied";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface DeviceOnboardingPageProps {
  params: Promise<{ deviceId: string }>;
}

/**
 * Manage-gated onboarding: binding and config issuance require device manage. A
 * phone has no config to deliver, so that visit redirects; a viewer who lacks
 * `manage` is told so instead of being bounced.
 */
export default function DeviceOnboardingPage({ params }: DeviceOnboardingPageProps) {
  const { deviceId } = use(params);
  const { data } = useIotDevice(deviceId);
  const router = useRouter();
  const locale = useLocale();

  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  // Only once the device is actually in hand: "not yet known" must not read as
  // "nothing to show here".
  const hasNoConfigToDeliver = !!data && data.deviceType === "mobile";

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoConfigToDeliver) router.replace(detailPath);
  }, [hasNoConfigToDeliver, detailPath, router]);

  if (!data || data.deviceType === "mobile") return null;

  if (!data.capabilities.canManage) {
    return <ResourceAccessDenied resource="device" />;
  }

  // Keyed so an issued config never survives a device-to-device navigation.
  return <DeviceOnboardingPanel key={data.id} device={data} />;
}
