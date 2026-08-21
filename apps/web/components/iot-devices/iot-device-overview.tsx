"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import {
  presentDevice,
  resolveDevicePrimaryLabel,
  resolveDeviceRoleLabels,
} from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Loader2, Trash2 } from "lucide-react";
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
import { toast } from "@repo/ui/hooks/use-toast";

import { MetaField } from "../experiment-dashboards/meta-field";
import { useFormatLastSeen } from "./device-connectivity";

/** Device registry metadata and its manage-gated danger zone. */
export function IotDeviceOverview({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteDevice, isPending: isDeleting } = useDeleteIotDevice({
    onSuccess: () => {
      toast({ title: t("iot.devices.remove.success") });
      router.push(`/${locale}/platform/devices`);
    },
  });

  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });
  const displayName = resolveDevicePrimaryLabel(present, t);
  const roleLabels = resolveDeviceRoleLabels(present, t);
  const formatLastSeen = useFormatLastSeen();

  const connectivityLabel = (connectivity: IotDeviceDetail["connectivity"]) => {
    if (connectivity === null) {
      return t("iot.devices.connectivity.unknown");
    }
    return connectivity.connected
      ? t("iot.devices.connectivity.connected")
      : t("iot.devices.connectivity.disconnected");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start gap-10">
        <MetaField label={t("iot.devices.detail.meta.serial")} value={device.serialNumber} />
        <MetaField
          label={t("iot.devices.detail.meta.type")}
          value={getSensorFamilyLabel(device.deviceType)}
        />
        {roleLabels.length > 0 && (
          <MetaField label={t("iot.devices.detail.meta.role")} value={roleLabels.join(" · ")} />
        )}
        <MetaField
          label={t("iot.devices.detail.meta.status")}
          value={t(`iot.devices.status.${device.status}`)}
        />
        <MetaField
          label={t("iot.devices.detail.meta.registered")}
          value={formatDate(device.createdAt)}
        />
        <MetaField label={t("iot.devices.detail.meta.thingName")} value={device.thingName} />
        <MetaField
          label={t("iot.devices.detail.meta.connectivity")}
          value={connectivityLabel(device.connectivity)}
        />
        <MetaField
          label={t("iot.devices.detail.meta.lastSeen")}
          value={formatLastSeen(device.connectivity)}
        />
      </div>

      {device.capabilities.canManage && (
        <SettingsCard
          title={t("iot.devices.detail.dangerZone.title")}
          contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium">{t("iot.devices.detail.dangerZone.deleteLabel")}</p>
            <p className="text-muted-foreground text-sm">
              {t("iot.devices.detail.dangerZone.deleteDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("iot.devices.actions.delete")}
          </Button>
        </SettingsCard>
      )}

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
                deleteDevice({ deviceId: device.id });
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
    </div>
  );
}
