"use client";

import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { useReinstateIotDevice } from "@/hooks/iot/useReinstateIotDevice/useReinstateIotDevice";
import { useRetireIotDevice } from "@/hooks/iot/useRetireIotDevice/useRetireIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { Archive, ArchiveRestore, Loader2, ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
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
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * The detail header's overflow menu: rare, whole-device actions, available
 * from every tab. Deleting lives here rather than as a danger-zone card so
 * the overview reads as a hub, not a warning; the confirm still names the
 * device and the consequence before anything fires.
 */
export function DeviceHeaderActions({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState<"delete" | "retire" | "reinstate" | null>(null);

  const { mutate: deleteDevice, isPending: isDeleting } = useDeleteIotDevice({
    onSuccess: () => {
      toast({ title: t("iot.devices.remove.success") });
      router.push(`/${locale}/platform/devices`);
    },
  });
  const { mutate: retireDevice, isPending: isRetiring } = useRetireIotDevice({
    onSuccess: () => {
      toast({ title: t("iot.devices.retire.success") });
      setConfirming(null);
    },
  });
  const { mutate: reinstateDevice, isPending: isReinstating } = useReinstateIotDevice({
    onSuccess: () => {
      toast({ title: t("iot.devices.reinstate.success") });
      setConfirming(null);
    },
  });

  if (!device.capabilities.canManage) {
    return null;
  }

  const isRetired = device.status === "retired";
  const isBusy = isDeleting || isRetiring || isReinstating;
  const deviceName = resolveDeviceLabel(device, t);

  function confirmSelected() {
    if (confirming === "delete") {
      deleteDevice({ deviceId: device.id });
    } else if (confirming === "retire") {
      retireDevice(
        { deviceId: device.id },
        {
          onError: () => {
            toast({ title: t("iot.devices.retire.error"), variant: "destructive" });
          },
        },
      );
    } else if (confirming === "reinstate") {
      reinstateDevice(
        { deviceId: device.id },
        {
          onError: () => {
            toast({ title: t("iot.devices.reinstate.error"), variant: "destructive" });
          },
        },
      );
    }
  }

  function renderLifecycleItem() {
    if (isRetired) {
      return (
        <DropdownMenuItem
          onSelect={() => {
            setConfirming("reinstate");
          }}
        >
          <ArchiveRestore className="text-muted-foreground mr-2 size-4" />
          {t("iot.devices.actions.reinstate")}
        </DropdownMenuItem>
      );
    }
    return (
      <DropdownMenuItem
        onSelect={() => {
          setConfirming("retire");
        }}
      >
        <Archive className="text-muted-foreground mr-2 size-4" />
        {t("iot.devices.actions.retire")}
      </DropdownMenuItem>
    );
  }

  const confirmCopy = {
    delete: {
      title: t("iot.devices.remove.title"),
      body: t("iot.devices.remove.confirm", { name: deviceName }),
      action: t("iot.devices.actions.delete"),
      destructive: true,
    },
    retire: {
      title: t("iot.devices.retire.title"),
      body: t("iot.devices.retire.confirm", { name: deviceName }),
      action: t("iot.devices.actions.retire"),
      destructive: true,
    },
    reinstate: {
      title: t("iot.devices.reinstate.title"),
      body: t("iot.devices.reinstate.confirm", { name: deviceName }),
      action: t("iot.devices.actions.reinstate"),
      destructive: false,
    },
  } as const;
  const copy = confirming === null ? null : confirmCopy[confirming];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {t("iot.devices.actions.title")}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {renderLifecycleItem()}
          <DropdownMenuItem
            onSelect={() => {
              setConfirming("delete");
            }}
            className="focus:text-destructive focus:bg-destructive/10 group"
          >
            <Trash2 className="text-muted-foreground group-focus:text-destructive mr-2 size-4" />
            {t("iot.devices.remove.title")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={copy !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setConfirming(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmSelected();
              }}
              className={
                copy?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : copy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
