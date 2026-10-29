"use client";

import { useGranteeTeams } from "@/hooks/organization/useGranteeTeams/useGranteeTeams";
import { useGranteeOrganizationSearch } from "@/hooks/sharing/useGranteeOrganizationSearch/useGranteeOrganizationSearch";
import { useState } from "react";

import type {
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { PeoplePicker } from "../people/picking/people-picker";
import { emailInviteFor, usePickerRows } from "../people/picking/picking-rule";
import { usePeopleSearch } from "../people/picking/use-people-search";
import type { ExistingGrant, SelectedGrantee, ShareContext } from "./share-candidates";
import { describeGroup, describeShareUser } from "./share-candidates";

export type GranteeSelection =
  | { kind: "grantee"; grantee: SelectedGrantee }
  | { kind: "email"; email: string };

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
  /** Grants already on the resource, so a team or organization row can state its level. */
  existingGrants?: ExistingGrant[];
  owningOrganizationId?: string | null;
  /** Addresses already invited, which never get the email-invitation row. */
  existingEmails?: string[];
  disabled?: boolean;
}

/**
 * Searches users, teams of the resource's owning organization, the caller's
 * organizations, and optionally unregistered email addresses. The host owns the
 * tier selector so all collaborator pages share one search surface.
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
  existingGrants = [],
  owningOrganizationId = null,
  existingEmails = [],
  disabled = false,
}: GranteePickerProps) {
  const { t } = useTranslation();

  const [granteeType, setGranteeType] = useState<SharingGranteeType>("user");

  const people = usePeopleSearch(
    { kind: "share", resourceType, resourceId },
    { enabled: granteeType === "user" },
  );
  const { term, debouncedTerm } = people;
  const {
    data: organizations,
    isFetching: isFetchingOrgs,
    isError: isOrgsError,
    refetch: refetchOrgs,
  } = useGranteeOrganizationSearch(debouncedTerm, { enabled: granteeType === "organization" });
  // Fetched up front rather than on switching to the tab: whether the option
  // exists at all is decided by whether this comes back with anything.
  const {
    data: teams,
    isFetching: isFetchingTeams,
    isError: isTeamsError,
    refetch: refetchTeams,
  } = useGranteeTeams(resourceType, resourceId);
  const hasTeams = (teams ?? []).length > 0;

  const context: ShareContext = {
    resourceType,
    role,
    typedEmail: people.typedEmail,
    existingGrants,
    owningOrganizationId,
    t,
  };
  // The teams endpoint takes no query, so the term filters what it returned.
  const filter = debouncedTerm.trim().toLowerCase();
  const rows = usePickerRows(
    granteeType === "user"
      ? people.people.map((user) => describeShareUser(user, context))
      : granteeType === "team"
        ? (teams ?? [])
            .filter((team) => team.name.toLowerCase().includes(filter))
            .map((team) =>
              describeGroup(
                "team",
                team,
                t("sharing.teamMemberCount", { count: team.memberCount }),
                context,
              ),
            )
        : (organizations ?? []).map((organization) =>
            describeGroup(
              "organization",
              organization,
              t("sharing.granteeTypeOrganization"),
              context,
            ),
          ),
    (row) => row,
  );

  const isDebouncing = term.length > 0 && !people.isSettled;
  const status =
    granteeType === "user"
      ? people.status
      : granteeType === "team"
        ? {
            isLoading: isFetchingTeams || isDebouncing,
            isError: isTeamsError,
            onRetry: () => void refetchTeams(),
          }
        : {
            isLoading: isFetchingOrgs || isDebouncing,
            isError: isOrgsError,
            onRetry: () => void refetchOrgs(),
          };

  const switchGranteeType = (next: SharingGranteeType) => {
    setGranteeType(next);
    people.setTerm("");
    onSelectionChange(null);
  };

  return (
    <PeoplePicker
      term={term}
      onTermChange={people.setTerm}
      selectionLabel={
        selection === null
          ? null
          : selection.kind === "email"
            ? selection.email
            : selection.grantee.displayName
      }
      onClear={() => onSelectionChange(null)}
      placeholder={
        granteeType === "user"
          ? allowEmailInvite
            ? t("sharing.searchUsersOrEmailPlaceholder")
            : t("sharing.searchUsersPlaceholder")
          : granteeType === "team"
            ? t("sharing.searchTeamsPlaceholder")
            : t("sharing.searchOrganizationsPlaceholder")
      }
      ariaLabel={t("sharing.granteeSearchLabel")}
      clearLabel={t("sharing.clearSelection")}
      disabled={disabled}
      browsable={granteeType !== "user"}
      status={status}
      rows={rows}
      onPick={(grantee) => onSelectionChange({ kind: "grantee", grantee })}
      emptyMessage={
        granteeType === "user"
          ? t("sharing.noUsersFound")
          : granteeType === "team"
            ? t("sharing.noTeamsFound")
            : t("sharing.noOrganizationsFound")
      }
      emailInvite={
        granteeType === "user"
          ? {
              ...emailInviteFor({
                allowed: allowEmailInvite,
                typed: term,
                settled: people.isSettled,
                isError: people.status.isError,
                candidates: people.people,
                invitedEmails: existingEmails,
              }),
              label: t("sharing.sendInviteByEmail"),
              onPick: (email) => onSelectionChange({ kind: "email", email }),
              messages: { invited: t("sharing.emailAlreadyInvited") },
            }
          : undefined
      }
      leading={
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
      }
    />
  );
}
