"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  IotDeviceGroupDetail,
  IotDeviceGroupMember,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";

/**
 * The group's facts as the overview's sidebar, in the organization About
 * card's grammar. The members indicator lives here (count plus live online
 * tally from the roster), so the left column stays purely the roster itself.
 */
export function GroupAboutCard({
  group,
  members,
}: {
  group: IotDeviceGroupDetail;
  members: IotDeviceGroupMember[];
}) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const onlineCount = members.filter((member) => member.connected === true).length;
  const connectivityUnknownCount = members.filter((member) => member.connected === null).length;

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        {t("iot.devices.detail.about.title")}
      </h2>

      <dl className="mt-4 space-y-3">
        <Row label={t("iot.groups.meta.members")}>
          {t("iot.groups.memberCount", { count: group.memberCount })}
        </Row>
        <Row label={t("iot.groups.overview.healthTitle")}>
          <span className="block">
            {t("iot.groups.monitoring.onlineValue", {
              online: onlineCount,
              total: members.length,
            })}
          </span>
          {connectivityUnknownCount > 0 && (
            <span className="text-muted-foreground block text-xs">
              {t("iot.groups.overview.healthUnknown", { count: connectivityUnknownCount })}
            </span>
          )}
        </Row>
        <Row label={t("iot.groups.meta.created")}>{formatDate(group.createdAt)}</Row>
      </dl>

      <Link
        href={`/${locale}/platform/devices/groups/${group.id}/monitoring`}
        className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
      >
        {t("iot.groups.overview.monitoringLink")}
      </Link>
    </Card>
  );
}

/** Stacked label over value: nothing competes for width in a narrow column. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
