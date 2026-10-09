"use client";

import { useMarkAllNotificationsRead } from "@/hooks/notifications/useMarkAllNotificationsRead/useMarkAllNotificationsRead";
import { useMarkNotificationsRead } from "@/hooks/notifications/useMarkNotificationsRead/useMarkNotificationsRead";
import { NOTIFICATIONS_PAGE_SIZE } from "@/hooks/notifications/useNotifications/notifications-list-query";
import { useNotifications } from "@/hooks/notifications/useNotifications/useNotifications";
import { useUnreadNotificationCount } from "@/hooks/notifications/useUnreadNotificationCount/useUnreadNotificationCount";
import { BellOff } from "lucide-react";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";

import { NotificationFeed } from "./notification-feed";

export function NotificationsPage() {
  const { t } = useTranslation("notifications");

  const notifications = useNotifications({ page: 1, pageSize: NOTIFICATIONS_PAGE_SIZE });
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Either source can enable the button. The count may be missing while the list
  // renders, and unread rows past the list's cap show up only in the count.
  const listedUnread = notifications.data?.items.some((item) => item.readAt === null) ?? false;
  const hasUnread = listedUnread || (unread.data?.count ?? 0) > 0;

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) {
      markRead.mutate({ ids: [notification.id] });
    }
  };

  const handleMarkAllRead = () => markAllRead.mutate(undefined);
  const retry = () => void notifications.refetch();

  const emptyState = (
    <EmptyState
      size="page"
      className="border-0"
      icon={<BellOff />}
      title={t("empty.title")}
      description={t("empty.description")}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={!hasUnread || markAllRead.isPending}
        >
          {t("markAllRead")}
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <NotificationFeed
          notifications={notifications.data?.items}
          isPending={notifications.isPending}
          isError={notifications.isError}
          onRetry={retry}
          onOpen={openNotification}
          empty={emptyState}
        />
      </Card>
    </div>
  );
}
