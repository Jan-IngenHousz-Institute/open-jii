"use client";

import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import {
  presentDevice,
  resolveDevicePrimaryLabel,
  resolveDeviceRoleLabels,
} from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Eye, KeyRound, MoreHorizontal, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { useFormatLastSeen } from "./device-connectivity";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";

export function IotDeviceTableRow({ device }: { device: IotDeviceWithConnectivity }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();

  const formatLastSeen = useFormatLastSeen();

  const viewHref = `/${locale}/platform/devices/${device.id}`;
  // Registry identity hierarchy: name, then canonical product name, then a
  // localized unknown-device fallback. The serial stays in its own column.
  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });
  const displayName = resolveDevicePrimaryLabel(present, t);
  const roleLabels = resolveDeviceRoleLabels(present, t);

  // The menu's first entry is the computed next step. Phones self-manage, so
  // they get neither; a device without live credentials is pointed at them,
  // everything else at onboarding.
  const isMobileFamily = device.deviceType === "mobile";
  const needsCredentials = device.status === "pending" || device.status === "revoked";

  function renderNextActionItem() {
    if (isMobileFamily) {
      return null;
    }
    if (needsCredentials) {
      return (
        <DropdownMenuItem asChild>
          <Link href={`${viewHref}/credentials`}>
            <KeyRound className="mr-2 size-4" />
            {t("iot.devices.nextAction.issueCredentials")}
          </Link>
        </DropdownMenuItem>
      );
    }
    return (
      <DropdownMenuItem asChild>
        <Link href={`${viewHref}/onboarding`}>
          <Rocket className="mr-2 size-4" />
          {t("iot.devices.nextAction.onboard")}
        </Link>
      </DropdownMenuItem>
    );
  }

  // Delete is deliberately absent: the list payload carries no capabilities,
  // so a destructive action here could not be gated. It lives in the detail
  // page's danger zone, which can ask `canManage`.
  return (
    <TableRow
      className="bg-background hover:bg-muted/50 has-data-[state=open]:bg-muted/50 group cursor-pointer"
      onClick={() => router.push(viewHref)}
    >
      <TableCell className="px-6 py-3">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-2">
            <Link
              href={viewHref}
              onClick={(e) => e.stopPropagation()}
              className="focus-visible:ring-primary/40 focus-visible:outline-hidden text-foreground text-[13px] font-semibold hover:underline focus-visible:ring-2"
            >
              {displayName}
            </Link>
            {/* Only when private: "public" is the unremarkable default. */}
            <VisibilityBadge visibility={device.visibility} privateOnly />
          </div>
          {roleLabels.length > 0 && (
            <span className="text-muted-foreground text-[11px]">{roleLabels.join(" · ")}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-3">
        <IotDeviceStatusBadge status={device.status} />
      </TableCell>
      <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
        {getSensorFamilyLabel(device.deviceType)}
      </TableCell>
      <TableCell className="text-muted-foreground px-6 py-3 font-mono text-xs">
        {device.serialNumber}
      </TableCell>
      <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
        {formatLastSeen(device.connectivity)}
      </TableCell>
      <TableCell className="text-muted-foreground px-6 py-3 text-[13px] tabular-nums">
        {formatDate(device.createdAt)}
      </TableCell>
      <TableCell className="w-12 px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {/* Persistently visible: no hover-only affordances anywhere in the domain. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("iot.devices.actions.more")}
              className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground inline-flex size-8 items-center justify-center rounded-md"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {renderNextActionItem()}
            <DropdownMenuItem asChild>
              <Link href={viewHref}>
                <Eye className="mr-2 size-4" />
                {t("iot.devices.actions.view")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
