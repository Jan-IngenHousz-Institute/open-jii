"use client";

import { NotificationRow } from "@/components/notifications/notification-row";
import { useMarkNotificationsRead } from "@/hooks/notifications/useMarkNotificationsRead/useMarkNotificationsRead";
import { useNotifications } from "@/hooks/notifications/useNotifications/useNotifications";
import { useUnreadNotificationCount } from "@/hooks/notifications/useUnreadNotificationCount/useUnreadNotificationCount";
import { useLocale } from "@/hooks/useLocale";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";

import { UNREAD_NOTIFICATIONS_INPUT } from "./dashboard-queries";
import { DashboardSection } from "./dashboard-section";
import { SeeAllLink } from "./see-all-link";

/**
 * What is waiting for the reader. It stays when nothing is unread, so it keeps its place and
 * does not vanish from under the reader who opens the last one.
 */
export function NotificationsSection() {
  const { t } = useTranslation();
  const { t: tNotifications } = useTranslation("notifications");
  const locale = useLocale();

  const unread = useNotifications(UNREAD_NOTIFICATIONS_INPUT);
  const count = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();

  // A list still loading or failed is left out rather than shown as caught up.
  const page = unread.data;
  if (page === undefined) {
    return null;
  }

  const isCaughtUp = page.items.length === 0;
  // The bell's count, so the two never disagree; the list's own total stands in until it loads.
  const unreadCount = count.data?.count ?? page.totalCount;

  const openNotification = (notification: Notification) => {
    markRead.mutate({ ids: [notification.id] });
  };

  const renderRow = (notification: Notification) => (
    <li key={notification.id}>
      <NotificationRow notification={notification} onOpen={openNotification} layout="rail" />
    </li>
  );

  const content = isCaughtUp ? (
    <p className="text-muted-foreground border-border border-t pt-3 text-sm">
      {tNotifications("empty.title")}
    </p>
  ) : (
    <ul className="divide-border divide-y border-t">{page.items.map(renderRow)}</ul>
  );

  return (
    <DashboardSection
      id="notifications"
      title={tNotifications("title")}
      meta={isCaughtUp ? null : tNotifications("unreadCount", { count: unreadCount })}
      action={
        <SeeAllLink href={`/${locale}/platform/notifications`}>{t("dashboard.seeAll")}</SeeAllLink>
      }
    >
      {content}
    </DashboardSection>
  );
}
