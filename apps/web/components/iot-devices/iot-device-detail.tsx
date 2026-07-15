"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useDeleteIotDevice } from "@/hooks/iot/useDeleteIotDevice/useDeleteIotDevice";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useState } from "react";

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
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import { toast } from "@repo/ui/hooks/use-toast";

import { MetaField } from "../experiment-dashboards/meta-field";
import { ComingSoonPanel } from "./coming-soon-panel";
import { DeviceOnboardingPanel } from "./device-onboarding-panel";
import { IotDeviceCredentialsCard } from "./iot-device-credentials-card";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";

export function IotDeviceDetail({ deviceId }: { deviceId: string }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const { data, isLoading, error } = useIotDevice(deviceId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const backHref = `/${locale}/platform/devices`;

  const { mutate: deleteDevice, isPending: isDeleting } = useDeleteIotDevice({
    onSuccess: () => {
      toast({ title: t("iot.devices.remove.success") });
      router.push(backHref);
    },
  });

  if (isLoading) {
    return <div className="text-muted-foreground p-8 text-center">{tCommon("common.loading")}</div>;
  }

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 400) {
      notFound();
    }
    return <ErrorDisplay error={error} title={t("iot.devices.loadError")} />;
  }

  if (!data) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        {t("iot.devices.detail.notFound")}
      </div>
    );
  }

  const device = data.body;
  const displayName = device.name ?? device.serialNumber;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-6">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("iot.devices.detail.back")}
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[#011111]">{displayName}</h1>
          <IotDeviceStatusBadge status={device.status} />
        </div>
      </div>

      <NavTabs defaultValue="overview" className="mt-8">
        <NavTabsList>
          <NavTabsTrigger value="overview">{t("iot.devices.detailTabs.overview")}</NavTabsTrigger>
          <NavTabsTrigger value="credentials">
            {t("iot.devices.detailTabs.credentials")}
          </NavTabsTrigger>
          <NavTabsTrigger value="onboarding">
            {t("iot.devices.detailTabs.onboarding")}
          </NavTabsTrigger>
          <NavTabsTrigger value="members">{t("iot.devices.detailTabs.members")}</NavTabsTrigger>
          <NavTabsTrigger value="lineage">{t("iot.devices.detailTabs.lineage")}</NavTabsTrigger>
          <NavTabsTrigger value="monitoring">
            {t("iot.devices.detailTabs.monitoring")}
          </NavTabsTrigger>
        </NavTabsList>

        <NavTabsContent value="overview" className="space-y-8">
          <div className="flex flex-wrap items-start gap-10">
            <MetaField label={t("iot.devices.detail.meta.serial")} value={device.serialNumber} />
            <MetaField label={t("iot.devices.detail.meta.type")} value={device.deviceType} />
            <MetaField
              label={t("iot.devices.detail.meta.status")}
              value={t(`iot.devices.status.${device.status}`)}
            />
            <MetaField
              label={t("iot.devices.detail.meta.registered")}
              value={formatDate(device.createdAt)}
            />
            <MetaField label={t("iot.devices.detail.meta.thingName")} value={device.thingName} />
          </div>

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
        </NavTabsContent>

        <NavTabsContent value="credentials" className="max-w-3xl">
          <IotDeviceCredentialsCard device={device} />
        </NavTabsContent>

        <NavTabsContent value="onboarding">
          <DeviceOnboardingPanel device={device} />
        </NavTabsContent>

        <NavTabsContent value="members">
          <ComingSoonPanel description={t("iot.devices.comingSoon.members")} />
        </NavTabsContent>
        <NavTabsContent value="lineage">
          <ComingSoonPanel description={t("iot.devices.comingSoon.lineage")} />
        </NavTabsContent>
        <NavTabsContent value="monitoring">
          <ComingSoonPanel description={t("iot.devices.comingSoon.monitoring")} />
        </NavTabsContent>
      </NavTabs>

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
                deleteDevice({ params: { deviceId: device.id } });
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
