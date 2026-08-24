"use client";

import { ErrorDisplay } from "@/components/error-display";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useDeleteIotDeviceGroup } from "@/hooks/iot/useDeleteIotDeviceGroup/useDeleteIotDeviceGroup";
import { useIotDeviceGroup } from "@/hooks/iot/useIotDeviceGroup/useIotDeviceGroup";
import { useIotDeviceGroupMembers } from "@/hooks/iot/useIotDeviceGroupMembers/useIotDeviceGroupMembers";
import { useRemoveIotDeviceGroupMember } from "@/hooks/iot/useRemoveIotDeviceGroupMember/useRemoveIotDeviceGroupMember";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import type { IotDeviceGroupMember } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { MetaField } from "../../experiment-dashboards/meta-field";
import { ActionChipLink } from "../action-chip-link";
import { deviceNeedsCredentials } from "../device-next-action";
import { DeviceIdentity } from "../device-row";
import { IotDeviceStatusBadge } from "../iot-device-status-badge";
import { AddGroupMembersDialog } from "./add-group-members-dialog";
import { DeleteDeviceGroupDialog } from "./delete-device-group-dialog";

export function DeviceGroupContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const { data: group, isLoading, isError, error } = useIotDeviceGroup(groupId);
  const { data: members } = useIotDeviceGroupMembers(groupId);
  // The chip aggregates over members: certificates are the one blocked step
  // this page can see without fanning out per-device reads.
  const credentialsNeededCount = (members ?? []).filter(deviceNeedsCredentials).length;
  const onlineCount = (members ?? []).filter((member) => member.connected === true).length;
  const connectivityUnknownCount = (members ?? []).filter(
    (member) => member.connected === null,
  ).length;
  const removeMember = useRemoveIotDeviceGroupMember();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteGroup = useDeleteIotDeviceGroup({
    onSuccess: () => {
      router.push(`/${locale}/platform/devices`);
    },
  });

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
  }
  if (isLoading || group === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const canContribute = group.capabilities.canContribute;

  function handleRemove(member: IotDeviceGroupMember) {
    removeMember.mutate({ groupId, deviceId: member.deviceId });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabBodyHeader
          title={t("iot.groups.overview.title")}
          description={t("iot.groups.overview.description")}
        />
        {credentialsNeededCount > 0 && (
          <ActionChipLink href={`/${locale}/platform/devices/groups/${groupId}/credentials`}>
            {t("iot.groups.nextAction.credentials", { count: credentialsNeededCount })}
          </ActionChipLink>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-10">
        <MetaField label={t("iot.groups.meta.members")} value={String(group.memberCount)} />
        <MetaField label={t("iot.groups.meta.created")} value={formatDate(group.createdAt)} />
      </div>

      {(members ?? []).length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader className="flex-row items-baseline justify-between space-y-0">
              <CardTitle className="text-base">{t("iot.groups.overview.healthTitle")}</CardTitle>
              <Link
                href={`/${locale}/platform/devices/groups/${groupId}/monitoring`}
                className="text-primary text-sm font-medium hover:underline"
              >
                {t("iot.groups.overview.monitoringLink")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-lg font-semibold">
                {t("iot.groups.monitoring.onlineValue", {
                  online: onlineCount,
                  total: (members ?? []).length,
                })}
              </p>
              {connectivityUnknownCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  {t("iot.groups.overview.healthUnknown", { count: connectivityUnknownCount })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {canContribute && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setAddOpen(true);
            }}
          >
            {t("iot.groups.addDevices")}
          </Button>
        </div>
      )}

      {(members ?? []).length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t("iot.groups.noMembers")}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("iot.groups.deviceColumn")}</TableHead>
                <TableHead>{t("iot.groups.familyColumn")}</TableHead>
                <TableHead>{t("iot.groups.statusColumn")}</TableHead>
                {canContribute && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => (
                <TableRow key={member.deviceId}>
                  <TableCell>
                    <DeviceIdentity
                      device={{ ...member, id: member.deviceId }}
                      href={`/${locale}/platform/devices/${member.deviceId}`}
                      showSerial
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[13px]">
                    {getSensorFamilyLabel(member.deviceType)}
                  </TableCell>
                  <TableCell>
                    <IotDeviceStatusBadge status={member.status} />
                  </TableCell>
                  {canContribute && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleRemove(member);
                        }}
                      >
                        {t("iot.groups.remove")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {group.capabilities.canManage && (
        <Card className="border-destructive/30 max-w-3xl shadow-none">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              {t("iot.groups.dangerZone.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{t("iot.groups.dangerZone.deleteLabel")}</p>
              <p className="text-muted-foreground text-sm">
                {t("iot.groups.dangerZone.deleteDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("iot.groups.delete")}
            </Button>
          </CardContent>
        </Card>
      )}

      <AddGroupMembersDialog
        groupId={groupId}
        memberIds={(members ?? []).map((member) => member.deviceId)}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <DeleteDeviceGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        groupName={group.name}
        isPending={deleteGroup.isPending}
        onConfirm={() => {
          deleteGroup.mutate({ groupId });
        }}
      />
    </div>
  );
}
