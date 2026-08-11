"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Mail, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/popover";

const emailSchema = z.string().email();

export type OrganizationInviteSelection =
  | { kind: "user"; userId: string; displayName: string }
  | { kind: "email"; email: string };

interface OrganizationMemberPickerProps {
  selection: OrganizationInviteSelection | null;
  onSelectionChange: (selection: OrganizationInviteSelection | null) => void;
  /** Roster user ids: still listed, but not addable a second time. */
  memberUserIds: string[];
  /** Roster addresses, for a member the user search cannot return. */
  memberEmails: string[];
  /** Addresses with a live invitation: neither addable nor invitable again. */
  pendingInvitationEmails: string[];
  disabled?: boolean;
}

interface UserResultRow {
  userId: string;
  displayName: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Why this row cannot be picked, or `null` when it can. */
  unavailable: "member" | "invited" | null;
}

/**
 * The organization's own grantee picker: search the platform's users, and fall back
 * to an email address only when nobody matches it.
 *
 * Deliberately the same shape as the sharing picker rather than a shared component —
 * that one selects between users, teams and organizations against a resource, this
 * one has exactly one source and a second outcome (an invitation) that sharing's
 * hosts do not all have.
 *
 * People already on the roster or already invited stay in the results, disabled with
 * the reason: dropping them makes the search look like it cannot find somebody who
 * is plainly there.
 */
export function OrganizationMemberPicker({
  selection,
  onSelectionChange,
  memberUserIds,
  memberEmails,
  pendingInvitationEmails,
  disabled = false,
}: OrganizationMemberPickerProps) {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [debouncedSearch, isDebounced] = useDebounce(search);
  const { data: users, isFetching } = useUserSearch(debouncedSearch);

  const results = useMemo<UserResultRow[]>(() => {
    const members = new Set(memberUserIds);
    const invited = new Set(pendingInvitationEmails.map((email) => email.toLowerCase()));

    return (users ?? []).map((user) => ({
      userId: user.userId,
      displayName: `${user.firstName} ${user.lastName}`.trim() || (user.email ?? user.userId),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      unavailable: members.has(user.userId)
        ? "member"
        : invited.has((user.email ?? "").toLowerCase())
          ? "invited"
          : null,
    }));
  }, [users, memberUserIds, pendingInvitationEmails]);

  const isLoading = isFetching || (!isDebounced && !!search);

  const typedEmail = search.trim();
  const isEmailTerm = emailSchema.safeParse(typedEmail).success;
  const matchesEmail = (addresses: string[]) =>
    addresses.some((address) => address.toLowerCase() === typedEmail.toLowerCase());
  const isMemberAddress = isEmailTerm && matchesEmail(memberEmails);
  const isInvitedAddress = isEmailTerm && matchesEmail(pendingInvitationEmails);
  // Only an address no account answers to is worth an invitation; a registered one
  // is the row above, which adds them outright.
  const isRegisteredAddress =
    isEmailTerm &&
    (users ?? []).some((user) => (user.email ?? "").toLowerCase() === typedEmail.toLowerCase());
  const canInviteByEmail =
    isEmailTerm && !isMemberAddress && !isInvitedAddress && !isRegisteredAddress;

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
        : selection.displayName;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            value={selectionLabel ?? search}
            readOnly={selection !== null}
            disabled={disabled}
            placeholder={t("organizations.invite.searchPlaceholder")}
            aria-label={t("organizations.invite.searchLabel")}
            className="pl-9 pr-9"
            onChange={(e) => {
              if (selection !== null) return;
              setSearch(e.target.value);
              setOpen(e.target.value.length > 0);
            }}
          />
          {(selection !== null || search.length > 0) && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearSelection}
              disabled={disabled}
              aria-label={t("organizations.invite.clearSelection")}
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
        <PickerResults
          results={results}
          isLoading={isLoading}
          email={typedEmail}
          canInviteByEmail={canInviteByEmail}
          emptyReason={isMemberAddress ? "member" : isInvitedAddress ? "invited" : "noMatch"}
          onSelect={(result) => {
            onSelectionChange({
              kind: "user",
              userId: result.userId,
              displayName: result.displayName,
            });
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
  );
}

function PickerResults({
  results,
  isLoading,
  email,
  canInviteByEmail,
  emptyReason,
  onSelect,
  onSelectEmail,
}: {
  results: UserResultRow[];
  isLoading: boolean;
  email: string;
  canInviteByEmail: boolean;
  emptyReason: "member" | "invited" | "noMatch";
  onSelect: (result: UserResultRow) => void;
  onSelectEmail: () => void;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
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
        {emptyReason === "member"
          ? t("organizations.invite.alreadyMember")
          : emptyReason === "invited"
            ? t("organizations.invite.alreadyInvited")
            : t("organizations.invite.noMatches")}
      </div>
    );
  }

  return (
    <div className="py-2">
      {results.map((result) => (
        <Button
          key={result.userId}
          type="button"
          variant="ghost"
          disabled={result.unavailable !== null}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(result)}
          className="hover:bg-surface flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          <UserAvatar
            avatarUrl={result.avatarUrl}
            firstName={result.firstName}
            lastName={result.lastName}
            className="h-9 w-9"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{result.displayName}</div>
            <div className="text-muted-foreground truncate text-xs">
              {result.unavailable === "member"
                ? t("organizations.invite.alreadyMember")
                : result.unavailable === "invited"
                  ? t("organizations.invite.alreadyInvited")
                  : result.email}
            </div>
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
      className="hover:bg-surface flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
        <Mail className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{email}</div>
        <div className="text-muted-foreground truncate text-xs">
          {t("organizations.invite.sendByEmail")}
        </div>
      </div>
    </Button>
  );
}
