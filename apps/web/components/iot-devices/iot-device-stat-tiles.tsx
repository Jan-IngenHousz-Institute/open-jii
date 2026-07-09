"use client";

import { CheckCircle2, Clock, Cpu, XCircle } from "lucide-react";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";

export function IotDeviceStatTiles({ devices }: { devices: IotDevice[] }) {
  const { t } = useTranslation("iot");

  const tiles = [
    {
      label: t("iot.devices.tabs.all"),
      count: devices.length,
      Icon: Cpu,
      iconClass: "text-[#68737B]",
    },
    {
      label: t("iot.devices.status.active"),
      count: devices.filter((d) => d.status === "active").length,
      Icon: CheckCircle2,
      iconClass: "text-green-600",
    },
    {
      label: t("iot.devices.status.pending"),
      count: devices.filter((d) => d.status === "pending").length,
      Icon: Clock,
      iconClass: "text-yellow-600",
    },
    {
      label: t("iot.devices.status.revoked"),
      count: devices.filter((d) => d.status === "revoked").length,
      Icon: XCircle,
      iconClass: "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map(({ label, count, Icon, iconClass }) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
        >
          <div>
            <div className="text-2xl font-semibold tabular-nums text-[#011111]">{count}</div>
            <div className="text-sm text-[#68737B]">{label}</div>
          </div>
          <Icon className={`h-5 w-5 ${iconClass}`} />
        </div>
      ))}
    </div>
  );
}
