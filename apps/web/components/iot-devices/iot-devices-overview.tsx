"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useLocale } from "@/hooks/useLocale";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { useDevicesRegister } from "./devices-register-context";
import { IotDeviceStatTiles } from "./iot-device-stat-tiles";
import { IotDevicesEmptyState } from "./iot-devices-empty-state";
import { IotDevicesTable } from "./iot-devices-table";

const RECENT_COUNT = 5;

export function IotDevicesOverview() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { openRegister } = useDevicesRegister();
  const { data, isLoading, isError, error } = useIotDevices();
  const devices = useMemo<IotDevice[]>(() => data?.body ?? [], [data]);

  const recent = useMemo(
    () =>
      [...devices]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_COUNT),
    [devices],
  );

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.devices.loadError")} />;
  }

  if (!isLoading && devices.length === 0) {
    return <IotDevicesEmptyState onRegister={openRegister} />;
  }

  const allHref = `/${locale}/platform/devices/all`;

  return (
    <div className="space-y-8">
      <IotDeviceStatTiles devices={devices} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#011111]">{t("iot.devices.recent.title")}</h2>
          <Button asChild variant="link" className="!p-0">
            <Link href={allHref}>
              {t("iot.devices.recent.viewAll")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <IotDevicesTable devices={recent} isLoading={isLoading} />
      </div>
    </div>
  );
}
