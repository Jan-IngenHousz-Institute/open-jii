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

/** What is waiting for the reader. Absent while nothing is unread. */
export function NotificationsSection() {
  const { t } = useTranslation();
  const { t: tNotifications } = useTranslation("notifications");
  const locale = useLocale();

  const unread = useNotifications(UNREAD_NOTIFICATIONS_INPUT);
  const count = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();

  const page = unread.data;
  if (page === undefined || page.items.length === 0) return null;

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

  return (
    <DashboardSection
      id="notifications"
      title={tNotifications("title")}
      meta={tNotifications("unreadCount", { count: unreadCount })}
      action={
        <SeeAllLink href={`/${locale}/platform/notifications`}>{t("dashboard.seeAll")}</SeeAllLink>
      }
    >
      <ul className="divide-border divide-y border-t">{page.items.map(renderRow)}</ul>
    </DashboardSection>
  );
}
