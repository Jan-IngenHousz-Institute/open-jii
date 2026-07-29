"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useGranteeOrganizationSearch } from "@/hooks/sharing/useGranteeOrganizationSearch/useGranteeOrganizationSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Building2, Mail, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { SharingGranteeType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
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

const emailSchema = z.string().email();

/** A grantee the user has picked, ready to be shared with. */
export interface SelectedGrantee {
  type: SharingGranteeType;
  id: string;
  displayName: string;
}

/**
 * What the picker resolved to: an account/organization that can be granted access
 * right now, or an email address that has to be invited first.
 */
export type GranteeSelection =
  | { kind: "grantee"; grantee: SelectedGrantee }
  | { kind: "email"; email: string };

/** A search result: a selectable grantee plus the extras used to render its row. */
interface GranteeResultRow extends SelectedGrantee {
  email?: string | null;
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
}

interface GranteePickerProps {
  selection: GranteeSelection | null;
  onSelectionChange: (selection: GranteeSelection | null) => void;
  /**
   * Offer "invite by email" for a typed address that matches no account. Only the
   * experiment surface has somewhere to put such an invitation, so it is opt-in.
   */
  allowEmailInvite?: boolean;
  /** Grantee ids already on the resource — filtered out of the results. */
  existingGranteeIds?: string[];
  /** Addresses already invited — offered as neither a result nor an email invite. */
  existingEmails?: string[];
  disabled?: boolean;
}

/**
 * Grantee search for a new share: individual users, whole organizations, and —
 * where the host allows it — an email address that has no account yet.
 *
 * Team grantees wait on team management, so they are not offered here. The access
 * tier is chosen by the host next to this field, which keeps this the only search
 * surface on any collaborators page.
 */
export function GranteePicker({
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

  // Only the active grantee type's query runs. User search needs a term (the whole
  // user table is not browsable); org search is scoped to the caller's own
  // memberships, so an empty term usefully lists them all.
  const { data: users, isFetching: isFetchingUsers } = useUserSearch(
    granteeType === "user" ? debouncedSearch : "",
  );
  const { data: organizations, isFetching: isFetchingOrgs } = useGranteeOrganizationSearch(
    debouncedSearch,
    { enabled: granteeType === "organization" },
  );

  const results = useMemo<GranteeResultRow[]>(() => {
    const existing = new Set(existingGranteeIds);
    if (granteeType === "user") {
      return (users ?? [])
        .filter((u) => !existing.has(u.userId))
        .map((u) => ({
          type: "user" as const,
          id: u.userId,
          displayName: `${u.firstName} ${u.lastName}`.trim() || (u.email ?? u.userId),
          email: u.email,
          avatarUrl: u.avatarUrl ?? null,
          firstName: u.firstName,
          lastName: u.lastName,
        }));
    }
    return (organizations ?? [])
      .filter((o) => !existing.has(o.id))
      .map((o) => ({ type: "organization" as const, id: o.id, displayName: o.name }));
  }, [granteeType, users, organizations, existingGranteeIds]);

  const isLoading =
    (granteeType === "user" ? isFetchingUsers : isFetchingOrgs) || (!isDebounced && !!search);

  const typedEmail = search.trim();
  const isEmailTerm = emailSchema.safeParse(typedEmail).success;
  const isEmailAlreadyInvited =
    isEmailTerm && existingEmails.some((e) => e.toLowerCase() === typedEmail.toLowerCase());
  // An invitation is only the right instrument for an address with no account
  // behind it: acceptance is what turns one into a grant, and an already-registered
  // invitee never goes through that step, so the invitation would sit pending
  // forever. Matched against the *unfiltered* results on purpose — someone who
  // already holds a grant is filtered out of the rows below, and offering their
  // address as an invitation would be the only thing left on screen.
  const isRegisteredAddress =
    isEmailTerm &&
    (users ?? []).some((u) => (u.email ?? "").toLowerCase() === typedEmail.toLowerCase());
  // Email invitations only make sense for the user side of the picker: an
  // organization is either on the platform or not addressable at all.
  const canInviteByEmail =
    allowEmailInvite &&
    granteeType === "user" &&
    isEmailTerm &&
    !isEmailAlreadyInvited &&
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
                  : t("sharing.searchOrganizationsPlaceholder")
              }
              aria-label={t("sharing.granteeSearchLabel")}
              className="pl-9 pr-9"
              onFocus={() => {
                // Organizations are browsable (the caller's own), so opening on
                // focus is useful; users need a term before there is anything
                // to show.
                if (selection === null && granteeType === "organization") setOpen(true);
              }}
              onChange={(e) => {
                if (selection !== null) return;
                setSearch(e.target.value);
                setOpen(granteeType === "organization" || e.target.value.length > 0);
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
            granteeType={granteeType}
            email={typedEmail}
            canInviteByEmail={canInviteByEmail}
            emptyReason={
              isEmailAlreadyInvited
                ? "alreadyInvited"
                : isRegisteredAddress
                  ? "alreadyCollaborator"
                  : "noMatch"
            }
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

/**
 * Why nothing is offered for the current term. A registered address with no row is
 * a grantee that was filtered out — they already hold a grant — which is worth
 * saying rather than reporting it as "no matching users".
 */
type EmptyReason = "alreadyInvited" | "alreadyCollaborator" | "noMatch";

function GranteeResults({
  results,
  isLoading,
  granteeType,
  email,
  canInviteByEmail,
  emptyReason,
  onSelect,
  onSelectEmail,
}: {
  results: GranteeResultRow[];
  isLoading: boolean;
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

  if (results.length === 0) {
    if (canInviteByEmail) {
      return (
        <div className="py-1">
          <InviteByEmailRow email={email} onClick={onSelectEmail} />
        </div>
      );
    }
    if (emptyReason === "alreadyInvited") {
      return (
        <div className="text-muted-foreground p-4 text-center text-sm">
          {t("sharing.emailAlreadyInvited")}
        </div>
      );
    }
    if (emptyReason === "alreadyCollaborator") {
      return (
        <div className="text-muted-foreground p-4 text-center text-sm">
          {t("sharing.emailAlreadyCollaborator")}
        </div>
      );
    }
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {granteeType === "user" ? t("sharing.noUsersFound") : t("sharing.noOrganizationsFound")}
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(result)}
          className="hover:bg-surface flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          {result.type === "user" ? (
            <UserAvatar
              avatarUrl={result.avatarUrl}
              firstName={result.firstName}
              lastName={result.lastName}
              className="h-9 w-9"
            />
          ) : (
            <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
              <Building2 className="text-muted-foreground h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{result.displayName}</div>
            {result.type === "user" ? (
              <div className="text-muted-foreground truncate text-xs">{result.email}</div>
            ) : (
              <div className="text-muted-foreground truncate text-xs">
                {t("sharing.granteeTypeOrganization")}
              </div>
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
      className="hover:bg-surface flex h-auto w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
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
