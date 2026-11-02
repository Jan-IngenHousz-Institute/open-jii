"use client";

import { NameLine, PersonIdentity } from "@/components/people/person-identity";
import { personName } from "@/components/people/person-name";
import { Building2, LogOut, Trash2, Users } from "lucide-react";
import type { ReactNode } from "react";

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
import { orgRoleBadge } from "./share-candidates";

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
        <span className="text-foreground truncate text-sm font-medium">{name}</span>
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
  resourceType,
  onRoleChange,
  onRevoke,
  isBusy,
  disabled = false,
  isSelf = false,
}: CollaboratorRowProps & { collaborator: ResourceOwnerDto | ResourceGrantDto }) {
  const { t } = useTranslation();

  const displayName = personName(collaborator.grantee, t);
  const isOrganization = collaborator.granteeType === "organization";
  const isTeam = collaborator.granteeType === "team";

  const isRedundant =
    collaborator.kind === "owner"
      ? !!collaborator.inertGrant
      : grantFacts(collaborator).isRedundant;
  const organizationRole =
    collaborator.kind === "owner" ? "owner" : collaborator.owningOrganization?.role;

  const badges = (
    <>
      {/* A team belongs to the owning organization by construction, so it is
        never an outside collaborator — the badge says what it is instead. */}
      {isTeam && <RowBadge>{t("sharing.granteeTypeTeam")}</RowBadge>}
      {/*
        Informational only — capability comes from the role. Never shown for a
        team: "outside collaborator" means the grantee is not in the owning
        organization, which a team cannot be, so the badge could only ever
        mislead here. Suppressed rather than trusted, because the flag arrives
        computed and a wrong `true` would otherwise be rendered as fact.
      */}
      {collaborator.kind === "grant" && !isTeam && collaborator.isOutsideCollaborator && (
        <RowBadge>{t("sharing.outsideCollaborator")}</RowBadge>
      )}
      {/* Access from two sources at once: this names the other one, so the row
        is not read as the whole story of what this person can reach. */}
      {organizationRole && <RowBadge>{orgRoleBadge(t)[organizationRole]}</RowBadge>}
      {isRedundant && <RowBadge>{t("sharing.redundantGrantBadge")}</RowBadge>}
    </>
  );

  return (
    // Stacked below sm: ~174px of shrink-0 controls left the name ~100px on a
    // phone. `sm:contents` returns the identity block to the row above sm.
    <div
      role="listitem"
      className="flex min-w-0 flex-col items-start gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    >
      <div className="flex w-full min-w-0 items-center gap-3 sm:contents">
        {isOrganization || isTeam ? (
          <>
            <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
              {isTeam ? (
                <Users className="text-muted-foreground h-4 w-4" />
              ) : (
                <Building2 className="text-muted-foreground h-4 w-4" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <NameLine badges={badges}>
                <span className="text-foreground truncate text-sm font-medium" title={displayName}>
                  {displayName}
                </span>
              </NameLine>
              <span className="text-muted-foreground truncate text-xs">
                {isTeam
                  ? // The head count is the one thing a team row carries that a name does
                    // not: it is how many people this single grant actually admits.
                    t("sharing.teamMemberCount", { count: collaborator.grantee.memberCount ?? 0 })
                  : t("sharing.granteeTypeOrganization")}
              </span>
            </div>
          </>
        ) : (
          <PersonIdentity
            person={{ id: collaborator.granteeId, ...collaborator.grantee }}
            badges={badges}
          />
        )}
      </div>

      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-end">
        {collaborator.kind === "owner" ? (
          <OwnerControls
            row={collaborator}
            resourceType={resourceType}
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
  resourceType,
  displayName,
  onRevoke,
  disabled,
}: {
  row: ResourceOwnerDto;
  resourceType: SharingResourceType;
  displayName: string;
  onRevoke: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
        {t(orgRoleTierKey("owner", resourceType))}
      </Badge>
      {row.inertGrant && (
        <RemoveGrantButton
          label={t("sharing.removeRedundantGrantForLabel", { name: displayName })}
          onClick={onRevoke}
          disabled={disabled}
        />
      )}
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

  const { orgAccess, isRedundant, canBeRaised } = grantFacts(row);

  return (
    <>
      {canBeRaised ? (
        <RoleSelect
          value={collapseRole(row.role)}
          onChange={onRoleChange}
          disabled={disabled}
          ariaLabel={t("sharing.roleForLabel", { name: displayName })}
          className="min-w-[8rem] flex-1 sm:w-[130px] sm:flex-none"
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

/** Both asked against the org role alone, since changing the tier replaces the grant. */
function grantFacts(row: ResourceGrantDto) {
  const orgAccess = {
    organizationRole: row.owningOrganization?.role ?? null,
    existingGrantRole: null,
  };
  return {
    orgAccess,
    // Does the tier they hold *now* add anything? Governs the badge.
    isRedundant: !roleRaisesAccess(orgAccess, collapseRole(row.role), row.resourceType),
    // Could any offerable tier? A separate question, and only false for an org role that
    // already carries everything — otherwise a member stuck on an inert tier would be
    // shown a badge and no way to raise the one tier that would work.
    canBeRaised: !holdsEveryGrantableAction(orgAccess, row.resourceType),
  };
}

function RowBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {children}
    </Badge>
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
