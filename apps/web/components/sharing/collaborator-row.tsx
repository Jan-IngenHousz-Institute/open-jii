"use client";

import { UserAvatar } from "@/components/user-avatar";
import { Building2, LogOut, Trash2, Users } from "lucide-react";

import type {
  OrganizationMemberRole,
  ResourceCollaboratorDto,
  ResourceGrantDto,
  ResourceOrgAdminsDto,
  ResourceOrgMembersDto,
  ResourceOwnerDto,
  ShareableRole,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import {
  collapseRole,
  effectiveRole,
  holdsEveryGrantableAction,
  roleRaisesAccess,
  shareableRoleLabelKey,
} from "./collaborator-roles";
import { RoleSelect } from "./role-select";

interface CollaboratorRowProps {
  collaborator: ResourceCollaboratorDto;
  /** The tiers a row states are matrix answers, and the matrix is per resource type. */
  resourceType: SharingResourceType;
  onRoleChange: (role: ShareableRole) => void;
  onRevoke: () => void;
  isBusy: boolean;
  disabled?: boolean;
  /** This grant is the signed-in user's own, so revoking it means leaving. */
  isSelf?: boolean;
}

// Literal keys, spelled out: an interpolated one is invisible to the string guard.
const ORG_ROLE_BADGE = {
  admin: "sharing.orgAdminBadge",
  member: "sharing.orgMemberBadge",
} as const;

/** Split a grantee display name into initials-friendly parts for the avatar. */
function nameParts(displayName: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = displayName.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/**
 * One row of the collaborators list. Access has two sources, and the row says which:
 * a grant, which has a tier and can be revoked, or the owning organization, which has
 * neither. Only owners are named one by one — they are the party answerable for the
 * resource; admins and members are each a single counted row.
 */
export function CollaboratorRow(props: CollaboratorRowProps) {
  switch (props.collaborator.kind) {
    case "orgAdmins":
      return <OrgAdminsRow row={props.collaborator} resourceType={props.resourceType} />;
    case "orgMembers":
      return <OrgMembersRow row={props.collaborator} resourceType={props.resourceType} />;
    case "owner":
    case "grant":
      return <PersonRow {...props} collaborator={props.collaborator} />;
    default:
      // A new variant reaches this as a compile error rather than a blank row.
      return assertNever(props.collaborator);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled collaborator kind: ${JSON.stringify(value)}`);
}

/** A group of the owning organization's people as one counted row. */
function OrgGroupRow({ name, count, tier }: { name: string; count: string; tier: string }) {
  return (
    <div role="listitem" className="flex items-center gap-3 px-3 py-2.5">
      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
        <Users className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="text-foreground truncate text-sm font-medium">{name}</h4>
        <span className="text-muted-foreground truncate text-xs">{count}</span>
      </div>
      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
        {tier}
      </Badge>
    </div>
  );
}

/** The tier an organization role alone confers, straight from the access matrix. */
function orgRoleTierKey(
  organizationRole: OrganizationMemberRole,
  resourceType: SharingResourceType,
): string {
  return shareableRoleLabelKey(
    effectiveRole({ organizationRole, existingGrantRole: null }, resourceType),
  );
}

/** The owning organization's administrators, who all hold the same full control. */
function OrgAdminsRow({
  row,
  resourceType,
}: {
  row: ResourceOrgAdminsDto;
  resourceType: SharingResourceType;
}) {
  const { t } = useTranslation();

  return (
    <OrgGroupRow
      name={t("sharing.orgAdminsName", { name: row.organizationName })}
      count={t("sharing.orgAdminsCount", { count: row.adminCount })}
      tier={t(orgRoleTierKey("admin", resourceType))}
    />
  );
}

/** Everyone in the owning organization who is not listed or counted above. */
function OrgMembersRow({
  row,
  resourceType,
}: {
  row: ResourceOrgMembersDto;
  resourceType: SharingResourceType;
}) {
  const { t } = useTranslation();

  return (
    <OrgGroupRow
      name={t("sharing.orgMembersName", { name: row.organizationName })}
      count={t("sharing.orgMembersCount", { count: row.memberCount })}
      // From the matrix, not from `organizations.base_permission`: that column is read
      // nowhere in the access path, so a row sourced from it would state a permission
      // nothing enforces.
      tier={t(orgRoleTierKey("member", resourceType))}
    />
  );
}

function PersonRow({
  collaborator,
  onRoleChange,
  onRevoke,
  isBusy,
  disabled = false,
  isSelf = false,
}: CollaboratorRowProps & { collaborator: ResourceOwnerDto | ResourceGrantDto }) {
  const { t } = useTranslation();

  const displayName =
    collaborator.grantee.displayName ?? collaborator.grantee.email ?? collaborator.granteeId;
  const { firstName, lastName } = nameParts(displayName);
  const isOrganization = collaborator.granteeType === "organization";
  const isTeam = collaborator.granteeType === "team";

  return (
    <div role="listitem" className="flex items-center gap-3 px-3 py-2.5">
      {isOrganization || isTeam ? (
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
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
          {/* Access from two sources at once: this names the other one, so the row
              is not read as the whole story of what this person can reach. */}
          {collaborator.kind === "grant" && collaborator.owningOrganization && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {t(ORG_ROLE_BADGE[collaborator.owningOrganization.role])}
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
        {collaborator.kind === "owner" ? (
          <OwnerControls
            row={collaborator}
            displayName={displayName}
            onRevoke={onRevoke}
            disabled={disabled || isBusy}
          />
        ) : (
          <GrantControls
            row={collaborator}
            displayName={displayName}
            isSelf={isSelf}
            onRoleChange={onRoleChange}
            onRevoke={onRevoke}
            disabled={disabled || isBusy}
          />
        )}
      </div>
    </div>
  );
}

/**
 * An owner holds every action through the organization, so there is no tier to move
 * them between — only a leftover grant to clear when one exists.
 */
function OwnerControls({
  row,
  displayName,
  onRevoke,
  disabled,
}: {
  row: ResourceOwnerDto;
  displayName: string;
  onRevoke: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {row.inertGrant && (
        <>
          <Badge variant="outline" className="shrink-0 text-xs font-normal">
            {t("sharing.redundantGrantBadge")}
          </Badge>
          <RemoveGrantButton
            label={t("sharing.removeRedundantGrantForLabel", { name: displayName })}
            onClick={onRevoke}
            disabled={disabled}
          />
        </>
      )}
      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
        {t("sharing.orgOwnerBadge")}
      </Badge>
    </>
  );
}

/**
 * A grant row states *effective* access — both sources combined — because the grant's
 * own tier understates an admin whose organization role outranks it. When the org role
 * already covers the grant, the tier control goes with it: moving it would write a
 * grant nobody's access reflects. The button only ever removes the grant; org-derived
 * access is an organization matter and must not read as revocable here.
 */
function GrantControls({
  row,
  displayName,
  isSelf,
  onRoleChange,
  onRevoke,
  disabled,
}: {
  row: ResourceGrantDto;
  displayName: string;
  isSelf: boolean;
  onRoleChange: (role: ShareableRole) => void;
  onRevoke: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  // Both asked against the org role alone, since changing the tier replaces the grant.
  const orgAccess = {
    organizationRole: row.owningOrganization?.role ?? null,
    existingGrantRole: null,
  };
  // Does the tier they hold *now* add anything? Governs the badge.
  const isRedundant = !roleRaisesAccess(orgAccess, collapseRole(row.role), row.resourceType);
  // Could any offerable tier? A separate question, and only false for an org role that
  // already carries everything — otherwise a member stuck on an inert tier would be
  // shown a badge and no way to raise the one tier that would work.
  const canBeRaised = !holdsEveryGrantableAction(orgAccess, row.resourceType);

  return (
    <>
      {isRedundant && (
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          {t("sharing.redundantGrantBadge")}
        </Badge>
      )}
      {canBeRaised ? (
        <RoleSelect
          value={collapseRole(row.role)}
          onChange={onRoleChange}
          disabled={disabled}
          ariaLabel={t("sharing.roleForLabel", { name: displayName })}
        />
      ) : (
        <Badge variant="secondary" className="shrink-0 text-xs font-normal">
          {t(
            shareableRoleLabelKey(
              effectiveRole(
                { organizationRole: orgAccess.organizationRole, existingGrantRole: row.role },
                row.resourceType,
              ),
            ),
          )}
        </Badge>
      )}
      {isSelf ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onRevoke}
          disabled={disabled}
          aria-label={t("sharing.leaveAction")}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : (
        <RemoveGrantButton
          label={
            isRedundant
              ? t("sharing.removeRedundantGrantForLabel", { name: displayName })
              : t("sharing.revokeForLabel", { name: displayName })
          }
          onClick={onRevoke}
          disabled={disabled}
        />
      )}
    </>
  );
}

function RemoveGrantButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
