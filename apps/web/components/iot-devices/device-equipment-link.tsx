"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { ExternalLink } from "lucide-react";
import { env } from "~/env";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

export function DeviceEquipmentLink({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const jiiOrganizationId = env.NEXT_PUBLIC_JII_ORGANIZATION_ID;
  const eligible =
    jiiOrganizationId !== undefined &&
    device.organizationId === jiiOrganizationId &&
    ["ambyte", "ambit", "multispeq"].includes(device.deviceType);
  const { data: organizations, isError, isPending } = useMyOrganizations({ enabled: eligible });
  const isJiiMember =
    !isError &&
    !isPending &&
    organizations.some((org) => org.id === jiiOrganizationId && !org.isPersonal);

  if (!eligible || !isJiiMember) return null;

  return (
    <a
      href={`${env.NEXT_PUBLIC_EQUIPMENT_URL}/assets/by-device/${encodeURIComponent(device.serialNumber)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 text-sm underline underline-offset-4"
    >
      {t("iot.devices.detail.equipmentLink")}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}
