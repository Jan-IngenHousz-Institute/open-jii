"use client";

import type { UserSearchResult } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";

import type { PersonLike } from "../people/person-name";
import { PeoplePicker } from "../people/picking/people-picker";
import type { PickerRow } from "../people/picking/picking-rule";
import {
  describeSearchedUser,
  emailInviteFor,
  usePickerRows,
} from "../people/picking/picking-rule";
import { usePeopleSearch } from "../people/picking/use-people-search";

export type OrganizationInviteSelection =
  | { kind: "user"; userId: string; displayName: string; person: PersonLike; email: string }
  | { kind: "email"; email: string };

interface InvitedUser {
  userId: string;
  displayName: string;
  person: PersonLike;
  /** Where the invitation goes: their address, or the hidden one typed in full. */
  email: string | null;
}

export interface OrganizationInviteContext {
  memberUserIds: readonly string[];
  memberEmails: readonly string[];
  pendingInvitationEmails: readonly string[];
  typedEmail: string | null;
  /** Replaces the member and pending reasons where neither is true yet, as in the wizard. */
  excludedLabel?: string;
  t: (key: string) => string;
}

export function describeOrganizationInviteCandidate(
  user: UserSearchResult,
  context: OrganizationInviteContext,
): PickerRow<InvitedUser> {
  const { t } = context;
  const email = user.email ?? (user.matchedEmail ? context.typedEmail : null);
  const listed = (emails: readonly string[]) =>
    email !== null && emails.some((e) => e.toLowerCase() === email.toLowerCase());

  const row = describeSearchedUser(user, {
    typedEmail: context.typedEmail,
    t,
    reason:
      context.memberUserIds.includes(user.userId) || listed(context.memberEmails)
        ? (context.excludedLabel ?? t("organizations.invite.alreadyMember"))
        : listed(context.pendingInvitationEmails)
          ? (context.excludedLabel ?? t("organizations.invite.alreadyInvited"))
          : email === null
            ? t("organizations.invite.enterExactEmail")
            : null,
  });
  return {
    ...row,
    value: {
      userId: user.userId,
      displayName: row.label,
      person: row.person ?? { id: user.userId },
      email,
    },
  };
}

interface OrganizationMemberPickerProps {
  selection: OrganizationInviteSelection | null;
  onSelectionChange: (selection: OrganizationInviteSelection | null) => void;
  /** Roster user ids: listed, but not addable again. */
  memberUserIds: string[];
  /** Roster addresses, for a member the user search cannot return. */
  memberEmails: string[];
  /** Addresses with a live invitation: neither addable nor invitable again. */
  pendingInvitationEmails: string[];
  /**
   * The reason for a member or a pending invitation when neither is true yet: the create
   * wizard collects people for an organization that does not exist, and "already a member"
   * of nothing reads as a bug.
   */
  excludedLabel?: string;
  disabled?: boolean;
}

/**
 * Searches the platform's users, and falls back to an email address only when no account
 * answers to it. Every outcome is an invitation, so a picked account rides with the
 * address the invitation goes to.
 */
export function OrganizationMemberPicker({
  selection,
  onSelectionChange,
  memberUserIds,
  memberEmails,
  pendingInvitationEmails,
  excludedLabel,
  disabled = false,
}: OrganizationMemberPickerProps) {
  const { t } = useTranslation();
  const search = usePeopleSearch({ kind: "global" });
  const rows = usePickerRows(search.people, (user) =>
    describeOrganizationInviteCandidate(user, {
      memberUserIds,
      memberEmails,
      pendingInvitationEmails,
      typedEmail: search.typedEmail,
      excludedLabel,
      t,
    }),
  );

  return (
    <PeoplePicker
      term={search.term}
      onTermChange={search.setTerm}
      selectionLabel={
        selection === null
          ? null
          : selection.kind === "email"
            ? selection.email
            : selection.displayName
      }
      onClear={() => onSelectionChange(null)}
      placeholder={t("organizations.invite.searchPlaceholder")}
      ariaLabel={t("organizations.invite.searchLabel")}
      clearLabel={t("organizations.invite.clearSelection")}
      disabled={disabled}
      status={search.status}
      rows={rows}
      onPick={({ email, ...user }) => {
        if (email !== null) onSelectionChange({ kind: "user", ...user, email });
      }}
      emptyMessage={t("organizations.invite.noMatches")}
      emailInvite={{
        ...emailInviteFor({
          allowed: true,
          typed: search.term,
          settled: search.isSettled,
          isError: search.status.isError,
          candidates: search.people,
          invitedEmails: pendingInvitationEmails,
          memberEmails,
        }),
        label: t("organizations.invite.sendByEmail"),
        onPick: (email) => onSelectionChange({ kind: "email", email }),
        messages: {
          invited: excludedLabel ?? t("organizations.invite.alreadyInvited"),
          member: excludedLabel ?? t("organizations.invite.alreadyMember"),
        },
      }}
    />
  );
}
