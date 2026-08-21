"use client";

import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import {
  presentDevice,
  resolveDevicePrimaryLabel,
  resolveDeviceRoleLabels,
} from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Eye, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@repo/ui/components/table";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { useFormatLastSeen } from "./device-connectivity";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";
import { LIST_TABLE_BORDER, LIST_TEXT_MUTED, LIST_TEXT_STRONG } from "./iot-devices-list-tokens";

export function IotDeviceTableRow({ device }: { device: IotDeviceWithConnectivity }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteDevice, isPending: isDeleting } = useDeleteIotDevice();
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

  const handleDelete = () => {
    deleteDevice(
      { deviceId: device.id },
      {
        onSuccess: () => {
          toast({ title: t("iot.devices.remove.success") });
          setConfirmingDelete(false);
        },
      },
    );
  };

  return (
    <>
      <TableRow
        className={cn(
          "bg-card hover:bg-muted has-[[data-state=open]]:bg-muted group cursor-pointer",
          LIST_TABLE_BORDER,
        )}
        onClick={() => router.push(viewHref)}
      >
        <TableCell className="px-6 py-3">
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-2">
              <Link
                href={viewHref}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
                  LIST_TEXT_STRONG,
                )}
              >
                {displayName}
              </Link>
              {/* Only when private: "public" is the unremarkable default. */}
              <VisibilityBadge visibility={device.visibility} privateOnly />
            </div>
            {roleLabels.length > 0 && (
              <span className={cn("text-[11px]", LIST_TEXT_MUTED)}>{roleLabels.join(" · ")}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="px-6 py-3">
          <IotDeviceStatusBadge status={device.status} />
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", LIST_TEXT_MUTED)}>
          {getSensorFamilyLabel(device.deviceType)}
        </TableCell>
        <TableCell className={cn("px-6 py-3 font-mono text-xs", LIST_TEXT_MUTED)}>
          {device.serialNumber}
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", LIST_TEXT_MUTED)}>
          {formatLastSeen(device.connectivity)}
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px] tabular-nums", LIST_TEXT_MUTED)}>
          {formatDate(device.createdAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("iot.devices.actions.more")}
                  className={cn("data-[state=open]:bg-accent size-8", LIST_TEXT_MUTED)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={viewHref}>
                    <Eye className="mr-2 size-4" />
                    {t("iot.devices.actions.view")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmingDelete(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("iot.devices.actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("iot.devices.remove.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("iot.devices.remove.confirm", { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("iot.devices.actions.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
