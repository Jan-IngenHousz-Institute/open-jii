"use client";

import { useMarkAllNotificationsRead } from "@/hooks/notifications/useMarkAllNotificationsRead/useMarkAllNotificationsRead";
import { useMarkNotificationsRead } from "@/hooks/notifications/useMarkNotificationsRead/useMarkNotificationsRead";
import { useNotifications } from "@/hooks/notifications/useNotifications/useNotifications";
import { useUnreadNotificationCount } from "@/hooks/notifications/useUnreadNotificationCount/useUnreadNotificationCount";
import { BellOff } from "lucide-react";
import { useState } from "react";
import { ListPagination } from "~/components/list-pagination";

import { zNotificationCategory } from "@repo/api/domains/notification/notification.schema";
import type {
  Notification,
  NotificationCategory,
} from "@repo/api/domains/notification/notification.schema";
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

const ALL_CATEGORIES = "all";

export function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const [readState, setReadState] = useState<ReadState>("all");
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [page, setPage] = useState(1);

  const notifications = useNotifications({ readState, category, page });
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = (unread.data?.count ?? 0) > 0;
  const totalPages = notifications.data?.totalPages ?? 0;
  const isUnreadView = readState === "unread";

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

  const renderCategoryOption = (option: NotificationCategory) => (
    <SelectItem key={option} value={option}>
      {t(`categories.${option}.label`)}
    </SelectItem>
  );

  const emptyState = (
    <EmptyState
      size="page"
      className="border-0"
      icon={<BellOff />}
      title={t("empty.title")}
      description={isUnreadView ? t("empty.unread") : t("empty.description")}
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
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>{t("filters.allCategories")}</SelectItem>
            {zNotificationCategory.options.map(renderCategoryOption)}
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

      <Card className="gap-0 overflow-hidden py-0">
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
