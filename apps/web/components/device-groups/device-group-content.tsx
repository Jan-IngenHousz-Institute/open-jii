"use client";

import { ErrorDisplay } from "@/components/error-display";
import {
  useDeleteDeviceGroup,
  useDeviceGroup,
  useDeviceGroupMembers,
  useRemoveDeviceGroupMember,
} from "@/hooks/device-groups/use-device-groups";
import { useLocale } from "@/hooks/useLocale";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import type { DeviceGroupMember } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { AddGroupMembersDialog } from "./add-group-members-dialog";
import { DeleteDeviceGroupDialog } from "./delete-device-group-dialog";

export function DeviceGroupContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const { data: group, isLoading, isError, error } = useDeviceGroup(groupId);
  const { data: members } = useDeviceGroupMembers(groupId);
  const removeMember = useRemoveDeviceGroupMember();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteGroup = useDeleteDeviceGroup({
    onSuccess: () => {
      router.push(`/${locale}/platform/devices`);
    },
  });

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
  }
  if (isLoading || group === undefined) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const canContribute = group.capabilities.canContribute;

  function handleRemove(member: DeviceGroupMember) {
    removeMember.mutate({ groupId, deviceId: member.deviceId });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/${locale}/platform/devices`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("iot.groups.backToDevices")}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{group.name}</h2>
          {group.description !== null && (
            <p className="text-muted-foreground text-sm">{group.description}</p>
          )}
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {t("iot.groups.memberCount", { count: group.memberCount })}
          </p>
        </div>
        <div className="flex gap-2">
          {canContribute && (
            <Button
              onClick={() => {
                setAddOpen(true);
              }}
            >
              {t("iot.groups.addDevices")}
            </Button>
          )}
          {group.capabilities.canManage && (
            <Button
              variant="outline"
              size="icon"
              aria-label={t("iot.groups.delete")}
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

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
                    {resolveDevicePrimaryLabel(
                      presentDevice({
                        name: member.name,
                        family: member.deviceType,
                        id: member.serialNumber,
                      }),
                      t,
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{member.deviceType}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {t(`iot.devices.status.${member.status}`)}
                    </Badge>
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
