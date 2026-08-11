"use client";

import { UserAvatar } from "@/components/user-avatar";
import { Building2, LogOut, Trash2, Users } from "lucide-react";

import type {
  ResourceCollaboratorDto,
  ShareableRole,
} from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { collapseRole } from "./collaborator-roles";
import { RoleSelect } from "./role-select";

interface CollaboratorRowProps {
  collaborator: ResourceCollaboratorDto;
  onRoleChange: (role: ShareableRole) => void;
  onRevoke: () => void;
  isBusy: boolean;
  disabled?: boolean;
  /** This grant is the signed-in user's own, so revoking it means leaving. */
  isSelf?: boolean;
}

/** Split a grantee display name into initials-friendly parts for the avatar. */
function nameParts(displayName: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = displayName.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/** Grant controls or a static owning-organization owner row. */
export function CollaboratorRow({
  collaborator,
  onRoleChange,
  onRevoke,
  isBusy,
  disabled = false,
  isSelf = false,
}: CollaboratorRowProps) {
  const { t } = useTranslation();

  const displayName =
    collaborator.grantee.displayName ?? collaborator.grantee.email ?? collaborator.granteeId;
  const { firstName, lastName } = nameParts(displayName);
  const isOrganization = collaborator.granteeType === "organization";
  const isTeam = collaborator.granteeType === "team";
  const isOwner = collaborator.kind === "owner";

  return (
    <div role="listitem" className="flex items-center gap-3 px-3 py-2.5">
      {isOrganization || isTeam ? (
        <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
          {isTeam ? (
            <Users className="text-muted-foreground h-4 w-4" />
          ) : (
            <Building2 className="text-muted-foreground h-4 w-4" />
          )}
        </div>
      ) : (
        <UserAvatar
          avatarUrl={collaborator.grantee.avatarUrl}
          firstName={firstName}
          lastName={lastName}
          className="h-9 w-9"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-foreground truncate text-sm font-medium" title={displayName}>
            {displayName}
          </h4>
          {isSelf && (
            <span className="text-muted-foreground shrink-0 text-xs">{t("sharing.you")}</span>
          )}
          {/* A team belongs to the owning organization by construction, so it is
              never an outside collaborator — the badge says what it is instead. */}
          {isTeam && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {t("sharing.granteeTypeTeam")}
            </Badge>
          )}
          {/*
            Informational only — capability comes from the role. Never shown for a
            team: "outside collaborator" means the grantee is not in the owning
            organization, which a team cannot be, so the badge could only ever
            mislead here. Suppressed rather than trusted, because the flag arrives
            computed and a wrong `true` would otherwise be rendered as fact.
          */}
          {collaborator.kind === "grant" && !isTeam && collaborator.isOutsideCollaborator && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {t("sharing.outsideCollaborator")}
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground truncate text-xs">
          {isTeam
            ? // The head count is the one thing a team row carries that a name does
              // not: it is how many people this single grant actually admits.
              t("sharing.teamMemberCount", { count: collaborator.grantee.memberCount ?? 0 })
            : isOrganization
              ? t("sharing.granteeTypeOrganization")
              : collaborator.grantee.email}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isOwner ? (
          <Badge variant="secondary" className="shrink-0 text-xs font-normal">
            {t("sharing.ownerBadge")}
          </Badge>
        ) : (
          <>
            <RoleSelect
              value={collapseRole(collaborator.role)}
              onChange={onRoleChange}
              disabled={disabled || isBusy}
              ariaLabel={t("sharing.roleForLabel", { name: displayName })}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={onRevoke}
              disabled={disabled || isBusy}
              aria-label={
                isSelf
                  ? t("sharing.leaveAction")
                  : t("sharing.revokeForLabel", { name: displayName })
              }
              className="text-muted-foreground hover:text-destructive"
            >
              {isSelf ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
