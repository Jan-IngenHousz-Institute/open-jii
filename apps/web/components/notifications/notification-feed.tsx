"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { NotificationRow } from "./notification-row";

type DayGroup = "today" | "yesterday" | "earlier";

const DAY_GROUPS: DayGroup[] = ["today", "yesterday", "earlier"];

function dayGroupOf(createdAt: string, startOfToday: Date): DayGroup {
  const created = new Date(createdAt);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

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
  empty: ReactNode;
  groupByDay?: boolean;
}

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

  if (isPending) {
    return (
      <div className="space-y-3 p-4" role="status" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const grouped = new Map<DayGroup, Notification[]>();
  for (const notification of notifications) {
    const group = dayGroupOf(notification.createdAt, startOfToday);
    grouped.set(group, [...(grouped.get(group) ?? []), notification]);
  }

  const renderGroup = (group: DayGroup) => {
    const items = grouped.get(group);
    if (!items) return null;

    return (
      <section key={group} aria-labelledby={`notifications-${group}`}>
        <h2
          id={`notifications-${group}`}
          className="text-muted-foreground px-4 pb-1 pt-4 text-xs font-medium uppercase tracking-wide"
        >
          {t(`groups.${group}`)}
        </h2>
        <ul className="divide-y">{items.map(renderRow)}</ul>
      </section>
    );
  };

  return <div>{DAY_GROUPS.map(renderGroup)}</div>;
}
