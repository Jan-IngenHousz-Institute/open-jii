"use client";

import { IotDeviceCredentialsCard } from "@/components/iot-devices/iot-device-credentials-card";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface DeviceCredentialsPageProps {
  params: Promise<{ deviceId: string }>;
}

/**
 * A device's certificate lifecycle. Every action here is gated on `manage`
 * server-side and reaches real AWS IoT, so the card is only offered to callers who
 * hold that capability.
 *
 * Somebody without it has no surface here and never saw the tab that leads here —
 * but they can still be sitting on the URL when their access is reduced, or have
 * bookmarked it. Send them back to the device rather than leaving them on a blank
 * route with no explanation, exactly as the collaborators route does. The empty
 * render below stays as the second line of defence: it is what holds while the
 * redirect is in flight, and it is what a typed URL gets.
 */
export default function DeviceCredentialsPage({ params }: DeviceCredentialsPageProps) {
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

  return (
    <div className="max-w-3xl">
      <IotDeviceCredentialsCard device={data} />
    </div>
  );
}
