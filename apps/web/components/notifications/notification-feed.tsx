"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { NotificationRow } from "./notification-row";

interface NotificationFeedProps {
  notifications: Notification[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpen: (notification: Notification) => void;
  /** What the bell and the page each say when there is nothing to list. */
  empty: ReactNode;
}

/** The shared list body: the bell's preview and the full page differ only in what surrounds it. */
export function NotificationFeed({
  notifications,
  isPending,
  isError,
  onRetry,
  onOpen,
  empty,
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

  return (
    <ul className="divide-y">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationRow notification={notification} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
