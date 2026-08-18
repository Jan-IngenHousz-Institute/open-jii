"use client";

import { useAddDeviceGroupMembers } from "@/hooks/device-groups/use-device-groups";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
import { useMemo, useState } from "react";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

interface AddGroupMembersDialogProps {
  groupId: string;
  memberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Offers the caller's own devices only: the batch add requires manage on
 * every device, and the creator always manages what they registered. Org
 * admins can manage more, but a list that sometimes 403s as a whole is worse
 * than a conservative one.
 */
export function AddGroupMembersDialog({
  groupId,
  memberIds,
  open,
  onOpenChange,
}: AddGroupMembersDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { data: devices } = useIotDevices();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addMembers = useAddDeviceGroupMembers();

  const candidates = useMemo(() => {
    const members = new Set(memberIds);
    return (devices ?? []).filter(
      (device) => device.createdBy === session?.user.id && !members.has(device.id),
    );
  }, [devices, memberIds, session?.user.id]);

  function toggle(deviceId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }

  function submit() {
    addMembers.mutate(
      { groupId, deviceIds: [...selected] },
      {
        onSuccess: () => {
          setSelected(new Set());
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("iot.groups.addDevicesTitle")}</DialogTitle>
          <DialogDescription>{t("iot.groups.addDevicesHint")}</DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">{t("iot.groups.noAddableDevices")}</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((device) => (
              <li key={device.id}>
                <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5">
                  <Checkbox
                    checked={selected.has(device.id)}
                    onCheckedChange={() => {
                      toggle(device.id);
                    }}
                  />
                  <span className="text-sm">
                    {resolveDevicePrimaryLabel(
                      presentDevice({
                        name: device.name,
                        family: device.deviceType,
                        id: device.serialNumber,
                      }),
                      t,
                    )}
                  </span>
                  <span className="text-muted-foreground ml-auto font-mono text-xs">
                    {device.deviceType}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {tCommon("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || addMembers.isPending}>
            {t("iot.groups.addSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
