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
  // Both shapes carry an address because both end in an invitation sent to one: a
  // picked account is invited at its own, never added. Non-nullable by construction —
  // the results below drop anyone the search returned without one, so a selection that
  // cannot be invited is not offered in the first place.
  | { kind: "user"; userId: string; displayName: string; email: string }
  | { kind: "email"; email: string };

interface OrganizationMemberPickerProps {
  selection: OrganizationInviteSelection | null;
  onSelectionChange: (selection: OrganizationInviteSelection | null) => void;
  /** Roster user ids: dropped from the results, since they cannot be added again. */
  memberUserIds: string[];
  /** Roster addresses, for a member the user search cannot return. */
  memberEmails: string[];
  /** Addresses with a live invitation: neither addable nor invitable again. */
  pendingInvitationEmails: string[];
  /**
   * How to explain a typed address that belongs to somebody the results excluded, when
   * "already a member" is not yet true of them. The create wizard collects people for
   * an organization that does not exist, so its exclusions are people it has already
   * collected — and telling somebody they are "already a member" of nothing reads as
   * a bug.
   */
  excludedLabel?: string;
  disabled?: boolean;
}

interface UserResultRow {
  userId: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * The organization's own grantee picker: search the platform's users, and fall back
 * to an email address only when nobody matches it.
 *
 * Deliberately the same shape as the sharing picker rather than a shared component —
 * that one selects between users, teams and organizations against a resource, this
 * one has exactly one source and one outcome — an invitation — where sharing grants
 * access outright.
 *
 * Whoever is already on the roster or already invited is dropped from the results
 * rather than listed unpickably, the same as the sharing picker: a row that cannot be
 * picked is noise in a list whose only purpose is picking. The reason is not lost — it
 * moves to where somebody actually needs it, the empty state for a typed address, so
 * "nothing found" is never the whole answer.
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

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [debouncedSearch, isDebounced] = useDebounce(search);
  const { data: users, isFetching, isError, refetch } = useUserSearch(debouncedSearch);

  const results = useMemo<UserResultRow[]>(() => {
    const members = new Set(memberUserIds);
    const invited = new Set(pendingInvitationEmails.map((email) => email.toLowerCase()));

    return (
      (users ?? [])
        .filter(
          (user) => !members.has(user.userId) && !invited.has((user.email ?? "").toLowerCase()),
        )
        // An address is what an invitation needs, and every pick now becomes one. The
        // search DTO types `email` as nullable because it is shared with reads that
        // anonymize a deactivated profile's address away; this endpoint only returns
        // activated, undeleted accounts, and `users.email` is `NOT NULL`, so this drops
        // nothing in practice — it is what lets the selection type promise an address.
        .flatMap<UserResultRow>((user) =>
          user.email === null
            ? []
            : [
                {
                  userId: user.userId,
                  displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  avatarUrl: user.avatarUrl ?? null,
                },
              ],
        )
    );
  }, [users, memberUserIds, pendingInvitationEmails]);

  const isLoading = isFetching || (!isDebounced && !!search);

  const typedEmail = search.trim();
  const isEmailTerm = emailSchema.safeParse(typedEmail).success;
  const matchesEmail = (addresses: string[]) =>
    addresses.some((address) => address.toLowerCase() === typedEmail.toLowerCase());
  const isMemberAddress = isEmailTerm && matchesEmail(memberEmails);
  const isInvitedAddress = isEmailTerm && matchesEmail(pendingInvitationEmails);
  // A typed address only needs the fallback row when no account answers to it: a
  // registered one is the row above, which invites that account by name. Read from the
  // unfiltered answer on purpose: an address belonging to somebody the results dropped
  // is then explained rather than reported as no match.
  const isRegisteredAddress =
    isEmailTerm &&
    (users ?? []).some((user) => (user.email ?? "").toLowerCase() === typedEmail.toLowerCase());
  // A failed search knows of no account, which is indistinguishable from an address
  // no account holds — so offering the invitation would turn a member into an invite.
  const canInviteByEmail =
    isEmailTerm && !isError && !isMemberAddress && !isInvitedAddress && !isRegisteredAddress;

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
          isError={isError}
          onRetry={() => void refetch()}
          email={typedEmail}
          canInviteByEmail={canInviteByEmail}
          excludedLabel={excludedLabel}
          // Roster first, then a live invitation, then the fallback: a registered
          // address with nothing left to show belongs to somebody the results dropped,
          // which is the same answer as a roster address.
          emptyReason={
            isMemberAddress
              ? "member"
              : isInvitedAddress
                ? "invited"
                : isRegisteredAddress
                  ? "member"
                  : "noMatch"
          }
          onSelect={(result) => {
            onSelectionChange({
              kind: "user",
              userId: result.userId,
              displayName: result.displayName,
              email: result.email,
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
  isError,
  onRetry,
  email,
  canInviteByEmail,
  emptyReason,
  excludedLabel,
  onSelect,
  onSelectEmail,
}: {
  results: UserResultRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  email: string;
  canInviteByEmail: boolean;
  emptyReason: "member" | "invited" | "noMatch";
  excludedLabel?: string;
  onSelect: (result: UserResultRow) => void;
  onSelectEmail: () => void;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">{t("common.loading")}</div>
    );
  }

  // Ahead of the empty branch: a failed search has no results either, and that branch
  // would report "nobody matches" for an answer nobody has.
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <p className="text-destructive text-sm">{t("organizations.invite.searchFailed")}</p>
        <Button
          type="button"
          variant="outline"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRetry}
        >
          {t("errors.tryAgain")}
        </Button>
      </div>
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
          ? (excludedLabel ?? t("organizations.invite.alreadyMember"))
          : emptyReason === "invited"
            ? (excludedLabel ?? t("organizations.invite.alreadyInvited"))
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
            <div className="text-muted-foreground truncate text-xs">{result.email}</div>
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
