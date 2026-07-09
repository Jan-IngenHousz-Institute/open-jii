"use client";

import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { formatDate } from "@/util/date";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import type { IotDevice } from "@repo/api/schemas/iot.schema";
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
import { Badge } from "@repo/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { TableCell, TableRow } from "@repo/ui/components/table";
import { toast } from "@repo/ui/hooks/use-toast";

const STATUS_VARIANT: Record<IotDevice["status"], "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  active: "default",
  revoked: "destructive",
};

interface IotDeviceTableRowProps {
  device: IotDevice;
}

export function IotDeviceTableRow({ device }: IotDeviceTableRowProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteIotDevice, isPending: isDeleting } = useDeleteIotDevice({
    onSuccess: () => {
      toast({ title: t("devices.remove.success") });
      setConfirmingDelete(false);
    },
  });

  const displayName = device.name ?? device.serialNumber;

  const handleDeleteSelect = (e: Event) => {
    e.preventDefault();
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = () => {
    deleteIotDevice({ params: { deviceId: device.id } });
  };

  return (
    <>
      <TableRow className="group">
        <TableCell className="font-medium">{displayName}</TableCell>
        <TableCell className="font-mono text-xs">{device.serialNumber}</TableCell>
        <TableCell>{device.deviceType}</TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[device.status]}>
            {t(`devices.status.${device.status}`)}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground tabular-nums">
          {formatDate(device.createdAt)}
        </TableCell>
        <TableCell className="w-12 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("devices.actions.delete")}
                className="hover:bg-accent data-[state=open]:bg-accent text-muted-foreground inline-flex size-8 items-center justify-center rounded-md"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={handleDeleteSelect}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                {t("devices.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("devices.remove.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("devices.remove.confirm", { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("devices.actions.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
