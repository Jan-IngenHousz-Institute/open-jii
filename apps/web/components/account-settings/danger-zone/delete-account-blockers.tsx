"use client";

import { AlertTriangle, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTransferExperimentAdmin } from "~/hooks/experiment/useTransferExperimentAdmin/useTransferExperimentAdmin";
import { useDebounce } from "~/hooks/useDebounce";
import { useUserSearch } from "~/hooks/useUserSearch";

import type { DeletionBlocker, UserMetadata, UserProfile } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

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
  const { mutate: transferAdmin, isPending } = useTransferExperimentAdmin({
    onSuccess: () => {
      // Resolved experiments leave the refetched list; clear local selections.
      setAssignments({});
      setApplyAllUser(null);
    },
  });

  // Candidates who belong to every blocking experiment — the clean picks for "transfer all".
  const sharedCandidates = useMemo<UserMetadata[]>(() => {
    if (blockers.length === 0) return [];

    const [firstBlocker, ...remainingBlockers] = blockers;

    const remainingCandidateIds = remainingBlockers.map(
      (blocker) => new Set(blocker.candidates.map((candidate) => candidate.userId)),
    );
    const seen = new Set<string>();

    return firstBlocker.candidates.filter((candidate) => {
      if (seen.has(candidate.userId)) return false;
      seen.add(candidate.userId);
      return remainingCandidateIds.every((candidateIds) => candidateIds.has(candidate.userId));
    });
  }, [blockers]);

  const setAssignment = (experimentId: string, user: UserProfile | null) => {
    setAssignments((prev) => ({ ...prev, [experimentId]: user }));
  };

  const applyToAll = (user: UserProfile | null) => {
    const previousApplyAllUserId = applyAllUser?.userId;

    setApplyAllUser(user);
    if (user) {
      setAssignments(Object.fromEntries(blockers.map((blocker) => [blocker.id, user])));
      return;
    }

    if (!previousApplyAllUserId) return;

    setAssignments((prev) => {
      const next = { ...prev };

      for (const blocker of blockers) {
        if (next[blocker.id]?.userId === previousApplyAllUserId) {
          delete next[blocker.id];
        }
      }

      return next;
    });
  };

  const transfers = useMemo(
    () =>
      blockers
        .map((blocker) => ({
          experimentId: blocker.id,
          targetUserId: assignments[blocker.id]?.userId,
        }))
        .filter((transfer): transfer is { experimentId: string; targetUserId: string } =>
          Boolean(transfer.targetUserId),
        ),
    [assignments, blockers],
  );

  const selectedTransferCount = transfers.length;
  const selectionProgress =
    blockers.length === 0 ? 0 : Math.round((selectedTransferCount / blockers.length) * 100);

  const handleTransfer = () => {
    if (transfers.length === 0 || isPending) return;
    transferAdmin({ body: { transfers } });
  };

  return (
    <div className="border-destructive/30 bg-muted flex flex-col gap-3 rounded-md border p-3 text-sm shadow-sm sm:min-h-0 sm:flex-1">
      <div className="flex items-start gap-3">
        <div className="bg-destructive/10 text-destructive flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-destructive font-medium">{t("dangerZone.delete.blockers.title")}</p>
            <Badge
              variant="outline"
              className="border-destructive/25 bg-background/80 text-destructive px-2 py-0.5 text-[11px] font-medium"
            >
              {selectedTransferCount}/{blockers.length}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("dangerZone.delete.blockers.description")}
          </p>
          <div
            aria-label={t("dangerZone.delete.blockers.title")}
            aria-valuemax={blockers.length}
            aria-valuemin={0}
            aria-valuenow={selectedTransferCount}
            aria-valuetext={`${selectedTransferCount}/${blockers.length}`}
            className="bg-destructive/10 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
          >
            <div
              className="bg-destructive h-full rounded-full transition-[width] duration-200"
              style={{ width: `${selectionProgress}%` }}
            />
          </div>
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
        <div className="border-border/70 bg-background/70 space-y-2 rounded-md border p-2.5">
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

      <ul className="space-y-2 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:pr-1 sm:[scrollbar-gutter:stable]">
        {blockers.map((blocker) => {
          const selectedUser = assignments[blocker.id] ?? null;

          return (
            <li
              key={blocker.id}
              className={cn(
                "border-border bg-background space-y-2 rounded-md border p-3 shadow-sm transition-colors",
                selectedUser && "border-primary/30 bg-quaternary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Badge
                    className={cn(
                      `bg-badge-${blocker.status}`,
                      "shrink-0 px-1.5 py-0.5 text-[11px] font-medium",
                    )}
                  >
                    {t(`experiments:status.${blocker.status}`)}
                  </Badge>
                  <span className="min-w-0 truncate font-medium">{blocker.name}</span>
                </div>
                <a
                  href={`/${locale}/platform/experiments/${blocker.id}/collaborators`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex h-7 min-w-0 max-w-[46%] shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-colors sm:max-w-none"
                >
                  <span className="truncate">{t("dangerZone.delete.blockers.manageLink")}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <TransferUserPicker
                suggestions={blocker.candidates}
                selectedUser={selectedUser}
                onSelect={(user) => setAssignment(blocker.id, user)}
                placeholder={t("dangerZone.delete.blockers.rowPlaceholder")}
                excludeUserId={currentUserId}
                disabled={isPending}
              />

              {blocker.candidates.length === 0 && !selectedUser && (
                <p className="text-muted-foreground bg-muted/70 rounded-sm px-2 py-1.5 text-xs leading-relaxed">
                  {t("dangerZone.delete.blockers.noCandidatesHint")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="destructive"
        className="w-full"
        isLoading={isPending}
        onClick={handleTransfer}
        disabled={selectedTransferCount === 0 || isPending}
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

  const selectableSuggestions = useMemo(() => {
    const seen = new Set<string>();

    return suggestions.filter((candidate) => {
      if (
        candidate.userId === excludeUserId ||
        candidate.userId === selectedUser?.userId ||
        seen.has(candidate.userId)
      ) {
        return false;
      }

      seen.add(candidate.userId);
      return true;
    });
  }, [excludeUserId, selectedUser?.userId, suggestions]);

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
            <Button
              key={candidate.userId}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onSelect(candidateToUserProfile(candidate))}
              className="hover:border-primary/30 hover:bg-quaternary/60 h-auto max-w-full gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-normal shadow-none"
            >
              <UserAvatar
                avatarUrl={candidate.avatarUrl}
                firstName={candidate.firstName}
                lastName={candidate.lastName}
                className="text-md h-6 w-6"
              />
              {candidate.firstName} {candidate.lastName}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
