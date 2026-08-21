"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useGranteeTeams } from "@/hooks/organization/useGranteeTeams/useGranteeTeams";
import { useGranteeOrganizationSearch } from "@/hooks/sharing/useGranteeOrganizationSearch/useGranteeOrganizationSearch";
import { useGranteeUserSearch } from "@/hooks/sharing/useGranteeUserSearch/useGranteeUserSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { Building2, Mail, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type {
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { GranteeAccess } from "./collaborator-roles";
import { holdsEveryGrantableAction, roleLabelKey, roleRaisesAccess } from "./collaborator-roles";

const emailSchema = z.string().email();

// Literal keys, spelled out: an interpolated one is invisible to the string guard.
const ORG_ROLE_BADGE = {
  owner: "sharing.orgOwnerBadge",
  admin: "sharing.orgAdminBadge",
  member: "sharing.orgMemberBadge",
} as const;

interface SelectedGrantee {
  type: SharingGranteeType;
  id: string;
  displayName: string;
  /**
   * Users only: the access they already hold, carried so the host can re-check the
   * tier it is about to grant. The picker only knows the tier selected when the row
   * was clicked, and that selector is free to move afterwards.
   */
  access?: GranteeAccess;
}

export type GranteeSelection =
  | { kind: "grantee"; grantee: SelectedGrantee }
  | { kind: "email"; email: string };

interface GranteeResultRow extends SelectedGrantee {
  email?: string | null;
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  /** Team rows only: how many people the grant would actually admit. */
  memberCount?: number;
  /** Labels for the access this candidate already holds, in badge order. */
  accessBadges?: string[];
  /** Why the selected tier would add nothing here; selectable while `null`. */
  inertReason?: string | null;
}

/**
 * Why granting the selected tier would change nothing for this candidate, or `null`
 * when it would raise their access.
 *
 * Somebody no tier can raise has hit that ceiling either through the owning
 * organization or through a share they already hold, and the reason has to name
 * whichever it is — claiming the organization for a grant holder who has no role there
 * describes access they do not have. Anyone else is merely being offered the wrong
 * tier, and a higher one may still work.
 */
function inertReason(
  access: GranteeAccess,
  role: ShareableRole,
  resourceType: SharingResourceType,
  t: (key: string) => string,
): string | null {
  // Literal keys, spelled out: an interpolated one is invisible to the string guard.
  if (holdsEveryGrantableAction(access, resourceType)) {
    const orgRoleAlone = { organizationRole: access.organizationRole, existingGrantRole: null };
    return holdsEveryGrantableAction(orgRoleAlone, resourceType)
      ? t("sharing.granteeHasFullAccess")
      : t("sharing.granteeHasFullAccessViaGrant");
  }
  return roleRaisesAccess(access, role, resourceType) ? null : t("sharing.granteeTierAddsNothing");
}

interface GranteePickerProps {
  /** The resource being shared — the teams source is scoped to its owning org. */
  resourceType: SharingResourceType;
  resourceId: string;
  /** The tier the host will grant, so a candidate it would not raise reads as inert. */
  role: ShareableRole;
  selection: GranteeSelection | null;
  onSelectionChange: (selection: GranteeSelection | null) => void;
  /** Only hosts that can persist pending invitations opt into email results. */
  allowEmailInvite?: boolean;
  /** Team and organization ids already on the resource — filtered out of the results. */
  existingGranteeIds?: string[];
  /** Addresses already invited — offered as neither a result nor an email invite. */
  existingEmails?: string[];
  disabled?: boolean;
}

/**
 * Searches users, teams of the resource's owning organization, the caller's
 * organizations, and optionally unregistered email addresses. The host owns the
 * tier selector so all collaborator pages share one search surface.
 *
 * People are annotated, never hidden. Someone whose organization role already
 * carries the tier is shown with that role and unselectable — dropping them is what
 * makes an administrator look like a stranger and sends people hunting for a name
 * the picker deliberately swallowed.
 *
 * The Teams source appears only when the owning organization actually has teams:
 * an empty source reads as a broken picker, and most resources belong to an
 * organization with none. It is scoped to the owning organization server-side,
 * which is what keeps a team grant from ever amounting to outside access.
 */
export function GranteePicker({
  resourceType,
  resourceId,
  role,
  selection,
  onSelectionChange,
  allowEmailInvite = false,
  existingGranteeIds = [],
  existingEmails = [],
  disabled = false,
}: GranteePickerProps) {
  const { t } = useTranslation();

  const [granteeType, setGranteeType] = useState<SharingGranteeType>("user");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [debouncedSearch, isDebounced] = useDebounce(search);

  // User search needs a term; an empty organization search lists memberships.
  const {
    data: users,
    isFetching: isFetchingUsers,
    isError: isUsersError,
  } = useGranteeUserSearch(resourceType, resourceId, granteeType === "user" ? debouncedSearch : "");
  const {
    data: organizations,
    isFetching: isFetchingOrgs,
    isError: isOrgsError,
  } = useGranteeOrganizationSearch(debouncedSearch, { enabled: granteeType === "organization" });
  // Fetched up front rather than on switching to the tab: whether the option
  // exists at all is decided by whether this comes back with anything.
  const {
    data: teams,
    isFetching: isFetchingTeams,
    isError: isTeamsError,
  } = useGranteeTeams(resourceType, resourceId);
  const hasTeams = (teams ?? []).length > 0;

  const results = useMemo<GranteeResultRow[]>(() => {
    const existing = new Set(existingGranteeIds);
    if (granteeType === "team") {
      // The teams endpoint takes no query, so the term filters what it returned.
      const term = debouncedSearch.trim().toLowerCase();
      return (teams ?? [])
        .filter((team) => !existing.has(team.id))
        .filter((team) => term === "" || team.name.toLowerCase().includes(term))
        .map((team) => ({
          type: "team" as const,
          id: team.id,
          displayName: team.name,
          memberCount: team.memberCount,
        }));
    }
    if (granteeType === "user") {
      return (users ?? []).map((u) => {
        const access: GranteeAccess = {
          organizationRole: u.organizationRole,
          existingGrantRole: u.existingGrantRole,
        };
        return {
          type: "user" as const,
          id: u.userId,
          displayName: `${u.firstName} ${u.lastName}`.trim() || (u.email ?? u.userId),
          email: u.email,
          avatarUrl: u.avatarUrl,
          firstName: u.firstName,
          lastName: u.lastName,
          access,
          accessBadges: [
            ...(u.organizationRole ? [t(ORG_ROLE_BADGE[u.organizationRole])] : []),
            ...(u.existingGrantRole
              ? [t("sharing.existingGrantBadge", { role: t(roleLabelKey(u.existingGrantRole)) })]
              : []),
          ],
          inertReason: inertReason(access, role, resourceType, t),
        };
      });
    }
    return (organizations ?? [])
      .filter((o) => !existing.has(o.id))
      .map((o) => ({ type: "organization" as const, id: o.id, displayName: o.name }));
  }, [
    granteeType,
    users,
    organizations,
    teams,
    debouncedSearch,
    existingGranteeIds,
    role,
    resourceType,
    t,
  ]);

  const isLoading =
    (granteeType === "user"
      ? isFetchingUsers
      : granteeType === "team"
        ? isFetchingTeams
        : isFetchingOrgs) ||
    (!isDebounced && !!search);

  // A failed read is not an empty one. Rendered as its own state, so "no matches"
  // stays a claim the server actually made.
  const isError =
    granteeType === "user" ? isUsersError : granteeType === "team" ? isTeamsError : isOrgsError;

  const typedEmail = search.trim();
  const isEmailTerm = emailSchema.safeParse(typedEmail).success;
  const isEmailAlreadyInvited =
    isEmailTerm && existingEmails.some((e) => e.toLowerCase() === typedEmail.toLowerCase());
  // An invitation to an address that already has an account would sit pending forever.
  const isRegisteredAddress =
    isEmailTerm &&
    (users ?? []).some((u) => (u.email ?? "").toLowerCase() === typedEmail.toLowerCase());
  const canInviteByEmail =
    allowEmailInvite &&
    granteeType === "user" &&
    isEmailTerm &&
    !isEmailAlreadyInvited &&
    // Whether the address already has an account is exactly what a failed search
    // cannot answer, and an invitation to one would sit pending forever.
    !isUsersError &&
    !isRegisteredAddress;

  const switchGranteeType = (next: SharingGranteeType) => {
    setGranteeType(next);
    setSearch("");
    onSelectionChange(null);
    setOpen(false);
  };

  const clearSelection = () => {
    onSelectionChange(null);
    setSearch("");
    setOpen(false);
  };

  const selectionLabel =
    selection === null
      ? null
      : selection.kind === "email"
        ? selection.email
        : selection.grantee.displayName;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={granteeType}
        onValueChange={(next) => switchGranteeType(next as SharingGranteeType)}
        disabled={disabled}
      >
        <SelectTrigger className="sm:w-[150px]" aria-label={t("sharing.granteeTypeLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">{t("sharing.granteeTypeUser")}</SelectItem>
          {hasTeams && <SelectItem value="team">{t("sharing.granteeTypeTeam")}</SelectItem>}
          <SelectItem value="organization">{t("sharing.granteeTypeOrganization")}</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor className="min-w-[200px] flex-1" asChild>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              value={selectionLabel ?? search}
              readOnly={selection !== null}
              disabled={disabled}
              placeholder={
                granteeType === "user"
                  ? allowEmailInvite
                    ? t("sharing.searchUsersOrEmailPlaceholder")
                    : t("sharing.searchUsersPlaceholder")
                  : granteeType === "team"
                    ? t("sharing.searchTeamsPlaceholder")
                    : t("sharing.searchOrganizationsPlaceholder")
              }
              aria-label={t("sharing.granteeSearchLabel")}
              className="pl-9 pr-9"
              onFocus={() => {
                // Organizations and teams are browsable without a search term.
                if (selection === null && granteeType !== "user") setOpen(true);
              }}
              onChange={(e) => {
                if (selection !== null) return;
                setSearch(e.target.value);
                setOpen(granteeType !== "user" || e.target.value.length > 0);
              }}
            />
            {(selection !== null || search.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                onClick={clearSelection}
                disabled={disabled}
                aria-label={t("sharing.clearSelection")}
                className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="max-h-[300px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <GranteeResults
            results={results}
            isLoading={isLoading}
            isError={isError}
            granteeType={granteeType}
            email={typedEmail}
            canInviteByEmail={canInviteByEmail}
            emptyReason={isEmailAlreadyInvited ? "alreadyInvited" : "noMatch"}
            onSelect={(grantee) => {
              onSelectionChange({ kind: "grantee", grantee });
              setSearch("");
              setOpen(false);
            }}
            onSelectEmail={() => {
              onSelectionChange({ kind: "email", email: typedEmail });
              setSearch("");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type EmptyReason = "alreadyInvited" | "noMatch";

function GranteeResults({
  results,
  isLoading,
  isError,
  granteeType,
  email,
  canInviteByEmail,
  emptyReason,
  onSelect,
  onSelectEmail,
}: {
  results: GranteeResultRow[];
  isLoading: boolean;
  isError: boolean;
  granteeType: SharingGranteeType;
  email: string;
  canInviteByEmail: boolean;
  emptyReason: EmptyReason;
  onSelect: (grantee: SelectedGrantee) => void;
  onSelectEmail: () => void;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
    );
  }

  // Ahead of the error state: the pending invitation is the host's own fact, not the
  // search's, so a failed search does not make it unknown — and it is the more useful
  // answer either way.
  if (results.length === 0 && emptyReason === "alreadyInvited") {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {t("sharing.emailAlreadyInvited")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-destructive p-4 text-center text-sm">{t("sharing.loadFailed")}</div>
    );
  }

  if (results.length === 0) {
    if (canInviteByEmail) {
      return (
        <div className="py-1">
          <InviteByEmailRow email={email} onClick={onSelectEmail} />
        </div>
      );
    }
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {granteeType === "user"
          ? t("sharing.noUsersFound")
          : granteeType === "team"
            ? t("sharing.noTeamsFound")
            : t("sharing.noOrganizationsFound")}
      </div>
    );
  }

  return (
    <div className="py-2">
      {results.map((result) => (
        <Button
          key={`${result.type}-${result.id}`}
          type="button"
          variant="ghost"
          disabled={!!result.inertReason}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(result)}
          className="hover:bg-muted flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-60"
        >
          {result.type === "user" ? (
            <UserAvatar
              avatarUrl={result.avatarUrl}
              firstName={result.firstName}
              lastName={result.lastName}
              className="h-9 w-9"
            />
          ) : (
            <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
              {result.type === "team" ? (
                <Users className="text-muted-foreground h-4 w-4" />
              ) : (
                <Building2 className="text-muted-foreground h-4 w-4" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{result.displayName}</span>
              {result.accessBadges?.map((badge) => (
                <Badge key={badge} variant="outline" className="shrink-0 text-xs font-normal">
                  {badge}
                </Badge>
              ))}
            </div>
            {result.type === "user" ? (
              <div className="text-muted-foreground truncate text-xs">{result.email}</div>
            ) : result.type === "team" ? (
              <div className="text-muted-foreground truncate text-xs">
                {t("sharing.teamMemberCount", { count: result.memberCount ?? 0 })}
              </div>
            ) : (
              <div className="text-muted-foreground truncate text-xs">
                {t("sharing.granteeTypeOrganization")}
              </div>
            )}
            {/* Its own line, under the address: an unselectable row that does not
                say why is the thing this picker used to do by hiding people. */}
            {result.inertReason && (
              <div className="text-muted-foreground text-xs">{result.inertReason}</div>
            )}
          </div>
        </Button>
      ))}
      {canInviteByEmail && (
        <div className="border-border border-t">
          <InviteByEmailRow email={email} onClick={onSelectEmail} />
        </div>
      )}
    </div>
  );
}

function InviteByEmailRow({ email, onClick }: { email: string; onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="hover:bg-muted flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
        <Mail className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{email}</div>
        <div className="text-muted-foreground truncate text-xs">
          {t("sharing.sendInviteByEmail")}
        </div>
      </div>
    </Button>
  );
}
