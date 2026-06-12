"use client";

import { AlertTriangle, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTransferExperimentAdmin } from "~/hooks/experiment/useTransferExperimentAdmin/useTransferExperimentAdmin";
import { useDebounce } from "~/hooks/useDebounce";
import { useUserSearch } from "~/hooks/useUserSearch";
import { parseApiError } from "~/util/apiError";

import type { DeletionBlocker, UserMetadata, UserProfile } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { UserAvatar } from "../../user-avatar";
import { UserSearchPopover } from "../../user-search-popover";

interface DeleteAccountBlockersProps {
  blockers: DeletionBlocker[];
  currentUserId: string;
  locale: string;
  /** Whether this section is taking over the dialog body. */
  expanded?: boolean;
  /** Toggles the expanded state; when omitted, the expand control is hidden. */
  onToggleExpanded?: () => void;
}

/** A blocker's other members carry only metadata; widen to UserProfile for the shared picker. */
function candidateToUserProfile(candidate: UserMetadata): UserProfile {
  return {
    userId: candidate.userId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: null,
    avatarUrl: candidate.avatarUrl,
    bio: null,
    activated: true,
  };
}

/**
 * Shown inside the Delete Account dialog when the user is the only admin of one or more
 * experiments. Lets them hand admin off — per experiment, with existing collaborators suggested,
 * or one person for all — in a single "Transfer" action. Deletion stays blocked until the list
 * clears (the transfer invalidates the deletion-blocker query, so resolved experiments drop off).
 */
export function DeleteAccountBlockers({
  blockers,
  currentUserId,
  locale,
  expanded = false,
  onToggleExpanded,
}: DeleteAccountBlockersProps) {
  const { t } = useTranslation("account");
  const [assignments, setAssignments] = useState<Record<string, UserProfile | null>>({});
  const [applyAllUser, setApplyAllUser] = useState<UserProfile | null>(null);
  const { mutateAsync: transferAdmin, isPending } = useTransferExperimentAdmin();

  // Candidates who belong to every blocking experiment — the clean picks for "transfer all".
  const sharedCandidates = useMemo<UserMetadata[]>(() => {
    if (blockers.length === 0) return [];
    return blockers.reduce<UserMetadata[]>(
      (shared, blocker) =>
        shared.filter((candidate) =>
          blocker.candidates.some((other) => other.userId === candidate.userId),
        ),
      [...blockers[0].candidates],
    );
  }, [blockers]);

  const setAssignment = (experimentId: string, user: UserProfile | null) => {
    setAssignments((prev) => ({ ...prev, [experimentId]: user }));
  };

  const applyToAll = (user: UserProfile | null) => {
    setApplyAllUser(user);
    if (user) {
      setAssignments(Object.fromEntries(blockers.map((blocker) => [blocker.id, user])));
    }
  };

  const transfers = blockers
    .map((blocker) => ({ experimentId: blocker.id, targetUserId: assignments[blocker.id]?.userId }))
    .filter((transfer): transfer is { experimentId: string; targetUserId: string } =>
      Boolean(transfer.targetUserId),
    );

  const handleTransfer = async () => {
    if (transfers.length === 0) return;
    try {
      const response = await transferAdmin({ body: { transfers } });
      const failed = response.body.results.filter((result) => !result.success);
      if (failed.length > 0) {
        toast({
          description: t("dangerZone.delete.blockers.transferPartial"),
          variant: "destructive",
        });
      } else {
        toast({ description: t("dangerZone.delete.blockers.transferSuccess") });
      }
      // Resolved experiments leave the refetched list; clear local selections.
      setAssignments({});
      setApplyAllUser(null);
    } catch (err) {
      toast({ description: parseApiError(err)?.message, variant: "destructive" });
    }
  };

  return (
    <div className="border-destructive/30 bg-muted flex min-h-0 flex-1 flex-col gap-3 rounded-md border p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="text-destructive font-medium">{t("dangerZone.delete.blockers.title")}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("dangerZone.delete.blockers.description")}
          </p>
        </div>
        {onToggleExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 h-7 w-7 shrink-0"
            onClick={onToggleExpanded}
            aria-label={t(
              expanded
                ? "dangerZone.delete.blockers.collapse"
                : "dangerZone.delete.blockers.expand",
            )}
            title={t(
              expanded
                ? "dangerZone.delete.blockers.collapse"
                : "dangerZone.delete.blockers.expand",
            )}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        )}
      </div>

      {blockers.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">
            {t("dangerZone.delete.blockers.applyToAllLabel")}
          </p>
          <TransferUserPicker
            suggestions={sharedCandidates}
            selectedUser={applyAllUser}
            onSelect={applyToAll}
            placeholder={t("dangerZone.delete.blockers.applyToAllPlaceholder")}
            excludeUserId={currentUserId}
            disabled={isPending}
          />
        </div>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {blockers.map((blocker) => (
          <li
            key={blocker.id}
            className="border-border bg-background space-y-2 rounded-md border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate font-medium">{blocker.name}</span>
                <Badge className={`bg-badge-${blocker.status}`}>
                  {t(`experiments:status.${blocker.status}`)}
                </Badge>
              </div>
              <a
                href={`/${locale}/platform/experiments/${blocker.id}/collaborators`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
              >
                {t("dangerZone.delete.blockers.manageLink")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <TransferUserPicker
              suggestions={blocker.candidates}
              selectedUser={assignments[blocker.id] ?? null}
              onSelect={(user) => setAssignment(blocker.id, user)}
              placeholder={t("dangerZone.delete.blockers.rowPlaceholder")}
              excludeUserId={currentUserId}
              disabled={isPending}
            />

            {blocker.candidates.length === 0 && !assignments[blocker.id] && (
              <p className="text-muted-foreground text-xs">
                {t("dangerZone.delete.blockers.noCandidatesHint")}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={handleTransfer}
        disabled={transfers.length === 0 || isPending}
      >
        {isPending
          ? t("dangerZone.delete.blockers.transferring")
          : t("dangerZone.delete.blockers.transferAll")}
      </Button>
    </div>
  );
}

interface TransferUserPickerProps {
  suggestions: UserMetadata[];
  selectedUser: UserProfile | null;
  onSelect: (user: UserProfile | null) => void;
  placeholder: string;
  excludeUserId: string;
  disabled?: boolean;
}

/**
 * A user picker for handing over admin: full platform search via the shared popover, plus the
 * experiment's existing collaborators offered as one-click suggestion chips.
 */
function TransferUserPicker({
  suggestions,
  selectedUser,
  onSelect,
  placeholder,
  excludeUserId,
  disabled,
}: TransferUserPickerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, isDebounced] = useDebounce(search, 300);
  const { data, isLoading } = useUserSearch(debouncedSearch);
  const isSearching = search.trim().length > 0;

  const availableUsers = useMemo<UserProfile[]>(() => {
    if (!isSearching) return [];
    const results = Array.isArray(data?.body) ? data.body : [];
    return results.filter((user) => user.userId !== excludeUserId);
  }, [isSearching, data, excludeUserId]);

  const selectableSuggestions = suggestions.filter(
    (candidate) => candidate.userId !== excludeUserId && candidate.userId !== selectedUser?.userId,
  );

  return (
    <div className="space-y-2">
      <UserSearchPopover
        availableUsers={availableUsers}
        searchValue={search}
        onSearchChange={setSearch}
        isAddingUser={false}
        loading={isSearching && (!isDebounced || isLoading)}
        onSelectUser={(user) => onSelect(user)}
        placeholder={placeholder}
        selectedUser={selectedUser}
        onClearSelection={() => onSelect(null)}
        disabled={disabled}
      />

      {!selectedUser && selectableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectableSuggestions.map((candidate) => (
            <button
              key={candidate.userId}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(candidateToUserProfile(candidate))}
              className="border-border hover:bg-surface inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs disabled:opacity-50"
            >
              <UserAvatar
                avatarUrl={candidate.avatarUrl}
                firstName={candidate.firstName}
                lastName={candidate.lastName}
                className="h-5 w-5"
              />
              {candidate.firstName} {candidate.lastName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
