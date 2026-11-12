"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { ExternalLink } from "lucide-react";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

// Equipment resolves production device identities; dev's JII test organization is separate.
const JII_ORGANIZATION_ID = "1beb5413-3b39-4d16-81b9-87ea686dfb45";

export function DeviceEquipmentLink({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const eligible =
    device.organizationId === JII_ORGANIZATION_ID &&
    ["ambyte", "ambit", "multispeq"].includes(device.deviceType);
  const { data: organizations, isError, isPending } = useMyOrganizations({ enabled: eligible });

  if (
    !eligible ||
    isError ||
    isPending ||
    !organizations.some((org) => org.id === JII_ORGANIZATION_ID && !org.isPersonal)
  )
    return null;

  return (
    <a
      href={`https://equipment.openjii.org/assets/by-device/${encodeURIComponent(device.serialNumber)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 text-sm underline underline-offset-4"
    >
      {t("iot.devices.detail.equipmentLink")}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}
