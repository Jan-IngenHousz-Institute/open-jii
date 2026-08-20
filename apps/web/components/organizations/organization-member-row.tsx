"use client";

import { UserAvatar } from "@/components/user-avatar";
import { LogOut, Network, Trash2 } from "lucide-react";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { organizationRoleLabelKey } from "./organization-labels";
import type { LeaveRejection, RemoveRejection } from "./organization-roster-rules";

interface OrganizationMemberRowProps {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  isSelf: boolean;
  /** Teams this member is on. Read-only here; a team's own page is where it changes. */
  teamNames: string[];
  /** Empty when the actor may not change this member's role — the badge stands in. */
  assignableRoles: OrganizationRole[];
  /** Why removal is unavailable, or `null` when it is offered. */
  removeRejection: RemoveRejection | null;
  /** Why the signed-in member cannot leave. Only consulted on their own row. */
  leaveRejection: LeaveRejection | null;
  isBusy: boolean;
  onRoleChange: (role: OrganizationRole) => void;
  onRemove: () => void;
  onLeave: () => void;
}

/**
 * One roster row. Every control is either offered or absent, never offered-and-
 * refused, except where the reason is worth stating — the last owner's disabled
 * remove and leave buttons carry it as their accessible name, because "there is no
 * button" would read as a bug rather than as the invariant it is.
 */
export function OrganizationMemberRow({
  displayName,
  email,
  avatarUrl,
  firstName,
  lastName,
  role,
  isSelf,
  teamNames,
  assignableRoles,
  removeRejection,
  leaveRejection,
  isBusy,
  onRoleChange,
  onRemove,
  onLeave,
}: OrganizationMemberRowProps) {
  const { t } = useTranslation();

  const removeReason =
    removeRejection === "lastOwner" ? t("organizations.members.lastOwnerReason") : null;
  const leaveReason =
    leaveRejection === "lastOwner" ? t("organizations.members.lastOwnerLeaveReason") : null;

  return (
    <div role="listitem" className="flex items-center gap-3 px-5 py-3">
      <UserAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastName}
        className="h-9 w-9"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-foreground truncate text-sm font-medium" title={displayName}>
            {displayName}
          </h4>
          {isSelf && (
            <span className="text-muted-foreground shrink-0 text-xs">{t("sharing.you")}</span>
          )}
        </div>
        <span className="text-muted-foreground truncate text-xs">{email}</span>
      </div>

      {/*
        Which teams this person is on, read-only: a team's membership is changed on the
        team, not on the roster. Absent rather than empty for somebody on none.

        The icon and the group's label both earn their place — a bare badge here could
        as easily be a department or a job title, and unlabelled it read as one. The
        label goes on the group rather than on each badge so assistive tech announces
        one set instead of repeating "Team" per name.
      */}
      {teamNames.length > 0 && (
        <div
          className="hidden shrink-0 items-center gap-1 md:flex"
          aria-label={t("organizations.teams.title")}
        >
          {teamNames.map((teamName) => (
            <Badge
              key={teamName}
              variant="outline"
              // The name is truncated to keep a three-team row readable, so the full
              // one has to stay reachable — an ellipsis alone is unidentifiable.
              title={teamName}
              className="text-muted-foreground max-w-[10rem] gap-1 font-normal"
            >
              <Network className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{teamName}</span>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {assignableRoles.length > 0 ? (
          <Select
            value={role}
            onValueChange={(next) => onRoleChange(next as OrganizationRole)}
            disabled={isBusy}
          >
            <SelectTrigger
              className="w-[130px]"
              aria-label={t("organizations.members.roleForLabel", { name: displayName })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((assignable) => (
                <SelectItem key={assignable} value={assignable}>
                  {t(organizationRoleLabelKey(assignable))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-xs font-normal">
            {t(organizationRoleLabelKey(role))}
          </Badge>
        )}

        {isSelf ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onLeave}
            disabled={isBusy || leaveRejection !== null}
            title={leaveReason ?? undefined}
            aria-label={
              leaveReason
                ? `${t("organizations.members.leaveAction")} — ${leaveReason}`
                : t("organizations.members.leaveAction")
            }
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : removeRejection === "notPermitted" ? null : (
          <Button
            type="button"
            variant="ghost"
            onClick={onRemove}
            disabled={isBusy || removeRejection !== null}
            title={removeReason ?? undefined}
            aria-label={
              removeReason
                ? `${t("organizations.members.removeForLabel", { name: displayName })} — ${removeReason}`
                : t("organizations.members.removeForLabel", { name: displayName })
            }
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
