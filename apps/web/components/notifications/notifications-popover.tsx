"use client";

import { sidebarUtilityRow } from "@/components/navigation/navigation-sidebar/sidebar-utility-row";
import { useMarkAllNotificationsRead } from "@/hooks/notifications/useMarkAllNotificationsRead/useMarkAllNotificationsRead";
import { useMarkNotificationsRead } from "@/hooks/notifications/useMarkNotificationsRead/useMarkNotificationsRead";
import { useNotifications } from "@/hooks/notifications/useNotifications/useNotifications";
import { useUnreadNotificationCount } from "@/hooks/notifications/useUnreadNotificationCount/useUnreadNotificationCount";
import { useMyOrganizationInvitations } from "@/hooks/organization/useMyOrganizationInvitations/useMyOrganizationInvitations";
import { useLocale } from "@/hooks/useLocale";
import { Bell } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";

import { NotificationFeed } from "./notification-feed";
import { NotificationInvitationsSection } from "./notification-invitations-section";

const NOTIFICATION_BELL_OPEN_EVENT = "openjii:open-notification-bell";
const PREVIEW_SIZE = 10;

/** The sidebar bell: the latest notifications, with the full history one link away. */
export function NotificationsPopover() {
  const { t } = useTranslation("notifications");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  const unread = useUnreadNotificationCount();
  const invitations = useMyOrganizationInvitations();
  const preview = useNotifications({ page: 1, pageSize: PREVIEW_SIZE }, { enabled: open });
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unread.data?.count ?? 0;
  const hasUnread = unreadCount > 0;
  // An invitation is neither read nor unread, it is unanswered, so it lights the dot
  // on its own until it is gone from the server's list.
  const hasInvitations = (invitations.data ?? []).length > 0;
  const label = t("title");

  React.useEffect(() => {
    // Idempotent: programmatic entry points (G N) always open the bell.
    const onOpenRequest = () => setOpen(true);
    window.addEventListener(NOTIFICATION_BELL_OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(NOTIFICATION_BELL_OPEN_EVENT, onOpenRequest);
  }, []);

  const closePopover = () => setOpen(false);

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) {
      markRead.mutate({ ids: [notification.id] });
    }
    closePopover();
  };

  const handleMarkAllRead = () => markAllRead.mutate(undefined);
  const retryPreview = () => void preview.refetch();

  const emptyPreview = (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium">{t("empty.title")}</p>
      <p className="text-muted-foreground mt-1 text-xs">{t("empty.description")}</p>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? `${label} (${t("unreadCount", { count: unreadCount })})` : label}
          className={sidebarUtilityRow()}
        >
          <Bell className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">{label}</span>
          {(hasUnread || hasInvitations) && (
            <span
              aria-hidden="true"
              data-testid="bell-indicator"
              className="bg-primary ml-auto size-2 shrink-0 rounded-full"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={isMobile ? "top" : "right"}
        sideOffset={6}
        collisionPadding={8}
        className="w-[380px] max-w-[calc(100vw-1rem)] p-0"
      >
        <NotificationInvitationsSection onNavigate={closePopover} />
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{label}</h3>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleMarkAllRead}
            disabled={!hasUnread || markAllRead.isPending}
            className="text-muted-foreground hover:text-foreground font-normal"
          >
            {t("markAllRead")}
          </Button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <NotificationFeed
            notifications={preview.data?.items}
            isPending={preview.isPending}
            isError={preview.isError}
            onRetry={retryPreview}
            onOpen={openNotification}
            empty={emptyPreview}
          />
        </div>
        <div className="border-t p-1.5">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={`/${locale}/platform/notifications`} onClick={closePopover}>
              {t("seeAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { NOTIFICATION_BELL_OPEN_EVENT };
