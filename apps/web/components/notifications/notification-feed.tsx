"use client";

import { useIsHydrated } from "@/hooks/useIsHydrated";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { NotificationRow } from "./notification-row";

const DAY_GROUPS = ["today", "yesterday", "earlier"] as const;

type DayGroup = (typeof DAY_GROUPS)[number];

/**
 * Midnight today and yesterday. The server renders in UTC, so the page hydrates on UTC days and
 * regroups on the reader's own afterwards; otherwise React discards the server's HTML.
 */
function startOfDays(isLocal: boolean): { startOfToday: Date; startOfYesterday: Date } {
  const startOfToday = new Date();
  const startOfYesterday = new Date();

  if (isLocal) {
    startOfToday.setHours(0, 0, 0, 0);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
  } else {
    startOfToday.setUTCHours(0, 0, 0, 0);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
    startOfYesterday.setUTCHours(0, 0, 0, 0);
  }
  return { startOfToday, startOfYesterday };
}

function dayGroupOf(createdAt: string, startOfToday: Date, startOfYesterday: Date): DayGroup {
  const created = new Date(createdAt);
  if (created >= startOfToday) return "today";
  if (created >= startOfYesterday) return "yesterday";
  return "earlier";
}

interface NotificationFeedProps {
  notifications: Notification[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpen: (notification: Notification) => void;
  /** What the bell and the page each say when there is nothing to list. */
  empty: ReactNode;
  /** The page heads the rows with Today / Yesterday / Earlier; the bell's preview does not. */
  groupByDay?: boolean;
}

/** The shared list body: the bell's preview and the full page differ only in what surrounds it. */
export function NotificationFeed({
  notifications,
  isPending,
  isError,
  onRetry,
  onOpen,
  empty,
  groupByDay = false,
}: NotificationFeedProps) {
  const { t } = useTranslation("notifications");
  const isHydrated = useIsHydrated();

  if (isPending) {
    return (
      <div className="space-y-3 p-4" role="status" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // A failed read is shown as a failure: an empty list would read as "nothing happened".
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2 p-4 text-sm" role="alert">
        <span className="inline-flex items-center gap-2">
          <CircleAlert className="text-destructive size-4 shrink-0" aria-hidden="true" />
          {t("loadError")}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return empty;
  }

  const renderRow = (notification: Notification) => (
    <li key={notification.id}>
      <NotificationRow notification={notification} onOpen={onOpen} />
    </li>
  );

  if (!groupByDay) {
    return <ul className="divide-y">{notifications.map(renderRow)}</ul>;
  }

  const { startOfToday, startOfYesterday } = startOfDays(isHydrated);

  const grouped = new Map<DayGroup, Notification[]>();
  for (const notification of notifications) {
    const group = dayGroupOf(notification.createdAt, startOfToday, startOfYesterday);
    const rows = grouped.get(group);
    if (rows) rows.push(notification);
    else grouped.set(group, [notification]);
  }

  return (
    <div>
      {DAY_GROUPS.map((group) => {
        const rows = grouped.get(group);
        if (!rows) return null;

        return (
          <section key={group} aria-labelledby={`notifications-${group}`}>
            <h2
              id={`notifications-${group}`}
              className="text-muted-foreground bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide"
            >
              {t(`groups.${group}`)}
            </h2>
            <ul className="divide-y border-t">{rows.map(renderRow)}</ul>
          </section>
        );
      })}
    </div>
  );
}
