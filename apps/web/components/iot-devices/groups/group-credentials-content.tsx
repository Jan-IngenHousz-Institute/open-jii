"use client";

import { CredentialConfirmDialog } from "@/components/iot-devices/credential-confirm-dialog";
import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useIotDeviceGroup } from "@/hooks/iot/useIotDeviceGroup/useIotDeviceGroup";
import { useIotDeviceGroupMembers } from "@/hooks/iot/useIotDeviceGroupMembers/useIotDeviceGroupMembers";
import { useIssueIotDeviceGroupCredentials } from "@/hooks/iot/useIssueIotDeviceGroupCredentials/useIssueIotDeviceGroupCredentials";
import { useRevokeIotDeviceGroupCredentials } from "@/hooks/iot/useRevokeIotDeviceGroupCredentials/useRevokeIotDeviceGroupCredentials";
import { useRotateIotDeviceGroupCredentials } from "@/hooks/iot/useRotateIotDeviceGroupCredentials/useRotateIotDeviceGroupCredentials";
import { useLocale } from "@/hooks/useLocale";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { KeyRound, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { IotDeviceGroupMember } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceRow } from "../device-row";
import { GroupCredentialResults } from "./group-credential-results";
import type { GroupCredentialBatch } from "./group-credential-results";

type CredentialAction = "issue" | "rotate" | "revoke";

/** Mirrors the contract's cap on an explicit `deviceIds` selection. */
const MAX_BATCH = 100;

const ELIGIBLE_STATUSES: Record<CredentialAction, readonly IotDeviceGroupMember["status"][]> = {
  issue: ["pending", "revoked"],
  rotate: ["active"],
  revoke: ["active", "rotating"],
};

/** Phones authenticate through the user's session; certificates never apply. */
function isEligible(member: IotDeviceGroupMember, action: CredentialAction): boolean {
  return member.deviceType !== "mobile" && ELIGIBLE_STATUSES[action].includes(member.status);
}

export function GroupCredentialsContent() {
  const { t } = useTranslation("iot");
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();
  const locale = useLocale();

  const { data: group } = useIotDeviceGroup(groupId);
  const { data: membersData, isLoading: isLoadingMembers } = useIotDeviceGroupMembers(groupId);
  const members = membersData ?? [];

  const [action, setAction] = useState<CredentialAction>("issue");
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  // Held in state, not read from the mutation: a failed retry resets mutation
  // data, and issued keys must stay available for delivery.
  const [batch, setBatch] = useState<GroupCredentialBatch | null>(null);

  const issueCredentials = useIssueIotDeviceGroupCredentials();
  const rotateCredentials = useRotateIotDeviceGroupCredentials();
  const revokeCredentials = useRevokeIotDeviceGroupCredentials();
  const isPending =
    issueCredentials.isPending || rotateCredentials.isPending || revokeCredentials.isPending;

  // Manage-gated like the device credentials route: the tab strip hides the
  // tab, this covers direct visits.
  const overviewPath = `/${locale}/platform/devices/groups/${groupId}`;
  const hasNoSurface = !!group && !group.capabilities.canManage;

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) router.replace(overviewPath);
  }, [hasNoSurface, overviewPath, router]);

  const eligible = members.filter((member) => isEligible(member, action));
  const selected = eligible.filter((member) => !deselectedIds.has(member.deviceId));
  const selectedIds = selected.map((member) => member.deviceId);
  const selectedOnlineCount = selected.filter((member) => member.connected === true).length;
  const isDisruptive = action === "rotate" || action === "revoke";
  // The contract rejects an oversized selection outright, so the page has to
  // ask for a smaller one instead of letting the submit die on a generic 400.
  const isOverCap = selectedIds.length > MAX_BATCH;

  function labelFor(member: IotDeviceGroupMember): string {
    return resolveDeviceLabel(member, t);
  }
  const labels = new Map(members.map((member) => [member.deviceId, labelFor(member)]));

  const handleActionChange = (value: string) => {
    if (value === "issue" || value === "rotate" || value === "revoke") {
      setAction(value);
      setDeselectedIds(new Set());
    }
  };

  const handleDeviceToggle = (deviceId: string, checked: boolean) => {
    setDeselectedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  // The batch endpoint succeeds even when every row fails, so the toast has to
  // read the rows, not the HTTP outcome.
  const reportOutcome = (rows: { error: string | null }[], successTitle: string) => {
    const anySucceeded = rows.some((row) => row.error === null);
    if (anySucceeded) {
      toast({ title: successTitle });
      return;
    }
    toast({ title: t("iot.groups.credentials.allFailed"), variant: "destructive" });
  };

  const runBatch = () => {
    const input = { groupId, deviceIds: selectedIds };
    const onError = () => {
      toast({ title: t("iot.groups.credentials.actionError"), variant: "destructive" });
    };
    const closeConfirm = () => {
      setConfirming(false);
    };

    if (action === "issue") {
      issueCredentials.mutate(input, {
        onSuccess: (data) => {
          setBatch({ action: "issue", rows: data.devices });
          reportOutcome(data.devices, t("iot.groups.credentials.issueSuccess"));
        },
        onError,
      });
      return;
    }

    if (action === "rotate") {
      rotateCredentials.mutate(input, {
        onSuccess: (data) => {
          setBatch({ action: "rotate", rows: data.devices });
          reportOutcome(data.devices, t("iot.groups.credentials.rotateSuccess"));
        },
        onError,
        onSettled: closeConfirm,
      });
      return;
    }

    revokeCredentials.mutate(input, {
      onSuccess: (data) => {
        setBatch({ action: "revoke", rows: data.devices });
        reportOutcome(data.devices, t("iot.groups.credentials.revokeSuccess"));
      },
      onError,
      onSettled: closeConfirm,
    });
  };

  const handleSubmit = () => {
    if (isDisruptive) {
      setConfirming(true);
      return;
    }
    runBatch();
  };

  function submitLabel(): string {
    if (action === "issue") {
      return t("iot.groups.credentials.submitIssue", { count: selectedIds.length });
    }
    if (action === "rotate") {
      return t("iot.groups.credentials.submitRotate", { count: selectedIds.length });
    }
    return t("iot.groups.credentials.submitRevoke", { count: selectedIds.length });
  }

  function ineligibleReason(member: IotDeviceGroupMember): string {
    if (member.deviceType === "mobile") {
      return t("iot.groups.credentials.mobileIneligible");
    }
    if (action === "issue") {
      return t("iot.groups.credentials.hasCredentialsIneligible");
    }
    if (member.status === "rotating") {
      return t("iot.groups.credentials.rotatingIneligible");
    }
    return t("iot.groups.credentials.noCertificateIneligible");
  }

  function renderMemberRow(member: IotDeviceGroupMember) {
    const eligibleMember = isEligible(member, action);

    return (
      <li key={member.deviceId}>
        <DeviceRow
          device={{ ...member, id: member.deviceId }}
          selection={{
            checked: eligibleMember && !deselectedIds.has(member.deviceId),
            disabled: !eligibleMember,
            onCheckedChange: (checked) => {
              handleDeviceToggle(member.deviceId, checked);
            },
          }}
          status={
            eligibleMember ? (
              <ConnectivityDot
                connectivity={
                  member.connected === null
                    ? null
                    : { connected: member.connected, lastSeenAt: null }
                }
              />
            ) : undefined
          }
          trailing={
            eligibleMember ? undefined : (
              <Badge variant="outline" className="text-muted-foreground font-normal">
                {ineligibleReason(member)}
              </Badge>
            )
          }
        />
      </li>
    );
  }

  if (!group || hasNoSurface) {
    return null;
  }

  if (isLoadingMembers) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <TabBodyHeader
        title={t("iot.groups.credentials.title")}
        description={t("iot.groups.credentials.description")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{t("iot.groups.credentials.actionTitle")}</CardTitle>
              <CardDescription>{t("iot.groups.credentials.actionDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ToggleGroup
                type="single"
                size="sm"
                value={action}
                onValueChange={handleActionChange}
                className="bg-muted w-fit rounded-md p-0.5"
              >
                <ToggleGroupItem value="issue">
                  {t("iot.groups.credentials.actionIssue")}
                </ToggleGroupItem>
                <ToggleGroupItem value="rotate">
                  {t("iot.groups.credentials.actionRotate")}
                </ToggleGroupItem>
                <ToggleGroupItem value="revoke">
                  {t("iot.groups.credentials.actionRevoke")}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground text-xs">
                {t(`iot.groups.credentials.${action}Hint`)}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {t("iot.groups.credentials.devicesTitle")}
                <Badge variant="secondary">
                  {t("iot.groups.credentials.devicesSelected", {
                    selected: selectedIds.length,
                    total: members.length,
                  })}
                </Badge>
              </CardTitle>
              <CardDescription>{t("iot.groups.credentials.devicesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.length === 0 ? (
                <EmptyState size="inline" description={t("iot.groups.noMembers")} />
              ) : (
                <ul className="divide-y rounded-lg border">{members.map(renderMemberRow)}</ul>
              )}

              <div className="flex items-center justify-end gap-4">
                {isOverCap && (
                  <p className="text-sm text-amber-600">
                    {t("iot.groups.credentials.overCap", { max: MAX_BATCH })}
                  </p>
                )}
                <Button
                  className="w-fit"
                  variant={action === "revoke" ? "destructive" : "default"}
                  onClick={handleSubmit}
                  disabled={selectedIds.length === 0 || isOverCap || isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      {action === "issue" && <KeyRound className="mr-2 h-4 w-4" aria-hidden />}
                      {action === "rotate" && <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
                      {action === "revoke" && <ShieldOff className="mr-2 h-4 w-4" aria-hidden />}
                    </>
                  )}
                  {submitLabel()}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {t("iot.groups.credentials.resultsTitle")}
              </CardTitle>
              {batch === null && (
                <Badge variant="outline">{t("iot.onboarding.rail.preview")}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                <p className="text-sm">
                  {t("iot.groups.credentials.devicesSelected", {
                    selected: selectedIds.length,
                    total: members.length,
                  })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t(`iot.groups.credentials.${action}Hint`)}
                </p>
              </div>
              {batch === null ? (
                <p className="text-muted-foreground text-xs">
                  {t("iot.groups.credentials.railEmpty")}
                </p>
              ) : (
                <GroupCredentialResults
                  groupName={group.name}
                  batch={batch}
                  labelByDeviceId={labels}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CredentialConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          action === "revoke"
            ? t("iot.groups.credentials.revokeConfirmTitle")
            : t("iot.groups.credentials.rotateConfirmTitle")
        }
        description={
          action === "revoke"
            ? t("iot.groups.credentials.revokeConfirm")
            : t("iot.groups.credentials.rotateConfirm")
        }
        warning={
          selectedOnlineCount > 0
            ? t("iot.groups.credentials.onlineWarning", { count: selectedOnlineCount })
            : undefined
        }
        actionLabel={
          action === "revoke"
            ? t("iot.groups.credentials.actionRevoke")
            : t("iot.groups.credentials.actionRotate")
        }
        destructive={action === "revoke"}
        pending={isPending}
        onConfirm={runBatch}
      />
    </div>
  );
}
