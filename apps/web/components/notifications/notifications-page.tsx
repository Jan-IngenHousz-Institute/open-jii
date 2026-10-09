"use client";

import { useMarkAllNotificationsRead } from "@/hooks/notifications/useMarkAllNotificationsRead/useMarkAllNotificationsRead";
import { useMarkNotificationsRead } from "@/hooks/notifications/useMarkNotificationsRead/useMarkNotificationsRead";
import { useNotifications } from "@/hooks/notifications/useNotifications/useNotifications";
import { useUnreadNotificationCount } from "@/hooks/notifications/useUnreadNotificationCount/useUnreadNotificationCount";
import { BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { ListPagination } from "~/components/list-pagination";

import type {
  Notification,
  NotificationCategory,
} from "@repo/api/domains/notification/notification.schema";
import { zNotificationCategory } from "@repo/api/domains/notification/notification.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import { NotificationFeed } from "./notification-feed";

type ReadState = "all" | "unread";

// `Select` has no value for "no filter", so the unfiltered item carries one of its own.
const ALL_CATEGORIES = "all";

export function NotificationsPage() {
  const { t } = useTranslation("notifications");

  const [readState, setReadState] = useState<ReadState>("all");
  const [category, setCategory] = useState<NotificationCategory | undefined>(undefined);
  const [page, setPage] = useState(1);

  const notifications = useNotifications({ readState, category, page });
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Either source can enable the button. The count may be missing while the list
  // renders, and unread rows past the list's cap show up only in the count.
  const listedUnread = notifications.data?.items.some((item) => item.readAt === null) ?? false;
  const hasUnread = listedUnread || (unread.data?.count ?? 0) > 0;
  const totalPages = notifications.data?.totalPages ?? 0;

  // Opening a row in the Unread view takes it out of the set, so this list shrinks
  // under the reader in normal use; snap back into range once a real (non-placeholder)
  // response says so, as every other paged list does.
  const { data, isPlaceholderData } = notifications;
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    const maxPage = Math.max(1, data.totalPages);
    if (page > maxPage) setPage(maxPage);
  }, [data, isPlaceholderData, page]);

  const changeReadState = (value: string) => {
    setReadState(value === "unread" ? "unread" : "all");
    setPage(1);
  };

  const changeCategory = (value: string) => {
    const parsed = zNotificationCategory.safeParse(value);
    setCategory(parsed.success ? parsed.data : undefined);
    setPage(1);
  };

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) {
      markRead.mutate({ ids: [notification.id] });
    }
  };

  const handleMarkAllRead = () => markAllRead.mutate(undefined);
  const retry = () => void notifications.refetch();

  // A filtered view that is empty has to say which filter emptied it; "you're all
  // caught up" would be a lie about the other rows the filter is hiding.
  const isFiltered = category !== undefined || readState === "unread";
  const emptyDescription = () => {
    if (category) return t("empty.category");
    if (readState === "unread") return t("empty.unread");
    return t("empty.description");
  };

  const emptyState = (
    <EmptyState
      size="page"
      className="border-0"
      icon={<BellOff />}
      title={isFiltered ? t("empty.filteredTitle") : t("empty.title")}
      description={emptyDescription()}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={readState} onValueChange={changeReadState}>
          <TabsList>
            <TabsTrigger value="all">{t("filters.all")}</TabsTrigger>
            <TabsTrigger value="unread">{t("filters.unread")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={category ?? ALL_CATEGORIES} onValueChange={changeCategory}>
          <SelectTrigger className="w-full sm:w-[240px]" aria-label={t("filters.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>{t("filters.allCategories")}</SelectItem>
            {zNotificationCategory.options.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`categories.${option}.label`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:ml-auto"
          onClick={handleMarkAllRead}
          disabled={!hasUnread || markAllRead.isPending}
        >
          {t("markAllRead")}
        </Button>
      </div>

      <Card
        aria-busy={isPlaceholderData}
        inert={isPlaceholderData}
        className={`gap-0 overflow-hidden py-0 transition-opacity ${isPlaceholderData ? "pointer-events-none opacity-50" : ""}`}
      >
        <NotificationFeed
          notifications={notifications.data?.items}
          isPending={notifications.isPending}
          isError={notifications.isError}
          onRetry={retry}
          onOpen={openNotification}
          empty={emptyState}
          groupByDay
        />
      </Card>

      {totalPages > 1 && (
        <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
