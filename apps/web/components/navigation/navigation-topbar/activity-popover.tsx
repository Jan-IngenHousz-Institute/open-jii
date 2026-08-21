"use client";

import { useActivity } from "@/components/activity/activity-context";
import type {
  ActivityEntry,
  ActivityJobKind,
  ActivityJobStatus,
} from "@/components/activity/activity-context";
import { useMyOrganizationInvitations } from "@/hooks/organization/useMyOrganizationInvitations/useMyOrganizationInvitations";
import { useLocale } from "@/hooks/useLocale";
import {
  Bell,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
  asOrganizationRole,
  organizationRoleLabelKey,
} from "~/components/organizations/organization-labels";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

const NOTIFICATION_BELL_OPEN_EVENT = "openjii:open-notification-bell";

function kindIcon(kind: ActivityJobKind) {
  if (kind === "data_export") return Database;
  if (kind === "ambyte_processing") return Upload;
  return RefreshCw;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusPill({ status }: { status: ActivityJobStatus }) {
  if (status === "running") {
    return (
      <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
        <Loader2 className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "succeeded") {
    return (
      <span className="text-status-active-foreground inline-flex items-center gap-1 text-xs font-medium">
        <CheckCircle2 className="size-3" />
        Succeeded
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-destructive inline-flex items-center gap-1 text-xs font-medium">
        <XCircle className="size-3" />
        Failed
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
        <Clock className="size-3" />
        Pending
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
      <Clock className="size-3" />
      Queued
    </span>
  );
}

function sortEntries(entries: ActivityEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Organization invitations, kept apart from the job list rather than folded into it.
 * They are a different kind of thing: an activity entry tracks a job this tab
 * started and is gone on reload, while an invitation is server-held, has no status
 * to run through, and stays actionable until it is answered.
 *
 * A failed read is shown as a failure. "You have no invitations" is not something to
 * infer from a refusal — Better Auth turns this endpoint down outright for an address
 * it considers unverified — and an invitation silently missing from here is exactly
 * the outcome the section exists to prevent.
 */
function InvitationsSection({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data, isPending, isError, isFetching, refetch } = useMyOrganizationInvitations();
  const invitations = data ?? [];

  // Nothing at all while the read is in flight, and nothing once it settles empty:
  // the bell belongs to the job list when there is no invitation to answer.
  if (isPending || (!isError && invitations.length === 0)) return null;

  return (
    <div className="border-b" data-testid="bell-invitations">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">{t("organizations.myInvitations.title")}</h3>
      </div>
      {isError ? (
        <div
          className="text-muted-foreground flex flex-col items-start gap-2 px-4 pb-3 text-xs"
          data-testid="bell-invitations-error"
        >
          <span className="text-foreground inline-flex items-center gap-2">
            <CircleAlert className="text-destructive size-4 shrink-0" aria-hidden />
            {t("organizations.myInvitations.loadError")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && <Loader2 className="mr-2 size-3 animate-spin" aria-hidden />}
            {t("organizations.myInvitations.retry")}
          </Button>
        </div>
      ) : (
        <ul className="max-h-[220px] divide-y overflow-y-auto border-t">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              {/* The tab, not a per-invitation address: an invitation belongs to an
                  email address, so the list this account is entitled to is the whole
                  of what there is to open. */}
              <Link
                href={`/${locale}/platform/account/invitations`}
                onClick={onNavigate}
                className="hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden flex items-start gap-3 px-4 py-3 transition-colors"
              >
                <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.organizationName}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("organizations.acceptInvitation.roleLabel")}{" "}
                    {t(organizationRoleLabelKey(asOrganizationRole(invitation.role)))}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActivityPopover({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const { entries, unreadCount, markAllRead } = useActivity();
  // The indicator's second source. `unreadCount` is answered by `lastSeenAt`, which
  // lives in memory and resets on reload; an invitation is neither read nor unread,
  // it is unanswered — so it drives the dot until it is gone from the server's list.
  // A failed read deliberately does not raise it: the refusal is permanent for an
  // unverified address, and a dot nobody can clear is worse than none.
  const { data: invitations } = useMyOrganizationInvitations();
  const hasInvitations = (invitations ?? []).length > 0;

  React.useEffect(() => {
    // Idempotent: programmatic entry points (G N) always open the hub.
    const onOpenRequest = () => setOpen(true);
    window.addEventListener(NOTIFICATION_BELL_OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(NOTIFICATION_BELL_OPEN_EVENT, onOpenRequest);
  }, []);

  // Clear unread count once the user has actually seen the list.
  React.useEffect(() => {
    if (open && unreadCount > 0) markAllRead();
  }, [open, unreadCount, markAllRead]);

  const sorted = React.useMemo(() => sortEntries(entries), [entries]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Activity${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          className={cn("text-foreground/70 hover:text-foreground relative", className)}
        >
          <Bell className="size-[18px]" />
          {(unreadCount > 0 || hasInvitations) && (
            <span
              aria-hidden="true"
              data-testid="bell-indicator"
              className="bg-primary absolute right-1 top-1 size-1.5 rounded-full"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[360px] p-0">
        <InvitationsSection onNavigate={() => setOpen(false)} />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Activity</h3>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={markAllRead}
            className="text-muted-foreground hover:text-foreground font-normal"
          >
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[400px]">
          {sorted.length === 0 ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              Nothing to show yet. Long-running tasks like exports and uploads will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {sorted.map((job) => {
                const Icon = kindIcon(job.kind);
                const rowClass = "flex items-start gap-3 px-4 py-3 transition-colors";
                const inner = (
                  <>
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusPill status={job.status} />
                        <span className="text-muted-foreground text-xs">
                          · {relativeTime(job.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </>
                );
                return (
                  <li key={job.id}>
                    {job.resultUrl ? (
                      <a
                        href={job.resultUrl}
                        className={cn(
                          rowClass,
                          "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden",
                        )}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className={rowClass}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export { NOTIFICATION_BELL_OPEN_EVENT };
