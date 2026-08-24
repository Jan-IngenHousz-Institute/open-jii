"use client";

import { useDeleteIotDeviceGroup } from "@/hooks/iot/useDeleteIotDeviceGroup/useDeleteIotDeviceGroup";
import { useLocale } from "@/hooks/useLocale";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IotDeviceGroupDetail } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
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
          <button
            type="button"
            aria-label={t("iot.devices.actions.more")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted inline-flex size-8 items-center justify-center rounded-md"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
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
