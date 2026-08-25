"use client";

import { useDeleteIotDeviceGroup } from "@/hooks/iot/useDeleteIotDeviceGroup/useDeleteIotDeviceGroup";
import { useLocale } from "@/hooks/useLocale";
import { ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IotDeviceGroupDetail } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { DeleteDeviceGroupDialog } from "./delete-device-group-dialog";

/**
 * The group header's overflow menu, mirroring the device header: rare,
 * whole-group actions reachable from every tab instead of a danger-zone card
 * on the overview.
 */
export function GroupHeaderActions({ group }: { group: IotDeviceGroupDetail }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteGroup = useDeleteIotDeviceGroup({
    onSuccess: () => {
      router.push(`/${locale}/platform/devices`);
    },
  });

  if (!group.capabilities.canManage) {
    return null;
  }

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
          <DropdownMenuItem
            onSelect={() => {
              setDeleteOpen(true);
            }}
            className="focus:text-destructive focus:bg-destructive/10 group"
          >
            <Trash2 className="text-muted-foreground group-focus:text-destructive mr-2 size-4" />
            {t("iot.groups.deleteTitle")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteDeviceGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        groupName={group.name}
        isPending={deleteGroup.isPending}
        onConfirm={() => {
          deleteGroup.mutate({ groupId: group.id });
        }}
      />
    </>
  );
}
