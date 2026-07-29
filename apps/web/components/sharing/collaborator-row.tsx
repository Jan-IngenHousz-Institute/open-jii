"use client";

import { UserAvatar } from "@/components/user-avatar";
import { Building2, LogOut, Trash2 } from "lucide-react";

import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import type { ShareableRole } from "./collaborator-roles";
import { collapseRole } from "./collaborator-roles";
import { RoleSelect } from "./role-select";

interface CollaboratorRowProps {
  grant: ResourceGrantDto;
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

/** One direct grant: grantee, outside-collaborator label, role select, revoke. */
export function CollaboratorRow({
  grant,
  onRoleChange,
  onRevoke,
  isBusy,
  disabled = false,
  isSelf = false,
}: CollaboratorRowProps) {
  const { t } = useTranslation();

  const displayName = grant.grantee.displayName ?? grant.grantee.email ?? grant.granteeId;
  const { firstName, lastName } = nameParts(displayName);
  const isOrganization = grant.granteeType === "organization";

  return (
    <div role="listitem" className="flex items-center gap-3 px-3 py-2.5">
      {isOrganization ? (
        <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
          <Building2 className="text-muted-foreground h-4 w-4" />
        </div>
      ) : (
        <UserAvatar
          avatarUrl={grant.grantee.avatarUrl}
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
          {/* Doc 009: informational only — capability comes from the role. */}
          {grant.isOutsideCollaborator && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {t("sharing.outsideCollaborator")}
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground truncate text-xs">
          {isOrganization ? t("sharing.granteeTypeOrganization") : grant.grantee.email}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <RoleSelect
          value={collapseRole(grant.role)}
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
            isSelf ? t("sharing.leaveAction") : t("sharing.revokeForLabel", { name: displayName })
          }
          className="text-muted-foreground hover:text-destructive"
        >
          {isSelf ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
