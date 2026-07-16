"use client";

import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useMemo } from "react";

import type { IotDevice } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

export function DevicesOverview() {
  const { t } = useTranslation("iot");
  const { data } = useIotDevices();
  const devices = useMemo<IotDevice[]>(() => data ?? [], [data]);

  const stats = useMemo(
    () => [
      { key: "total", label: t("iot.devices.overview.total"), value: devices.length },
      {
        key: "active",
        label: t("iot.devices.status.active"),
        value: devices.filter((d) => d.status === "active").length,
      },
      {
        key: "pending",
        label: t("iot.devices.status.pending"),
        value: devices.filter((d) => d.status === "pending").length,
      },
      {
        key: "revoked",
        label: t("iot.devices.status.revoked"),
        value: devices.filter((d) => d.status === "revoked").length,
      },
    ],
    [devices, t],
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-lg border border-[#EDF2F6] p-4">
          <p className="text-muted-foreground text-sm">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#011111]">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
