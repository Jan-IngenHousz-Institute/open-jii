"use client";

import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
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
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { toast } from "@repo/ui/hooks/use-toast";

import { MetaField } from "../experiment-dashboards/meta-field";
import { useFormatLastSeen } from "./device-connectivity";
import { deviceNextAction } from "./device-next-action";
import { DeviceNextActionChip } from "./device-next-action-chip";
import { DeviceOverviewCards } from "./device-overview-cards";

/** The stitched hub: metadata, summary cards into the neighbouring tabs, and
 * the manage-gated danger zone. */
export function IotDeviceOverview({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: boundExperiments } = useDeviceExperiments(device.id);
  const isMobileFamily = device.deviceType === "mobile";
  const nextAction = deviceNextAction(device, (boundExperiments ?? []).length);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabBodyHeader
          title={t("iot.devices.detail.overview.title")}
          description={t("iot.devices.detail.overview.description")}
        />
        {nextAction !== null && <DeviceNextActionChip deviceId={device.id} action={nextAction} />}
      </div>

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

      {!isMobileFamily && <DeviceOverviewCards device={device} />}

      {device.capabilities.canManage && (
        <Card className="border-destructive/30 max-w-3xl shadow-none">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              {t("iot.devices.detail.dangerZone.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {t("iot.devices.detail.dangerZone.deleteLabel")}
              </p>
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
          </CardContent>
        </Card>
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
