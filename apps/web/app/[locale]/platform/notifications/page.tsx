import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsListQuery,
} from "@/hooks/notifications/useNotifications/notifications-list-query";
import type { Metadata } from "next";
import { auth } from "~/app/actions/auth";
import { NotificationsPage } from "~/components/notifications/notifications-page";

import initTranslations from "@repo/i18n/server";

interface NotificationsRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NotificationsRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["notifications"] });

  return { title: t("title") };
}

export default async function NotificationsRoute() {
  const session = await auth();

  return (
    <PageContainer width="reading">
      <PrefetchedQueries
        queries={(utils) => [
          notificationsListQuery(utils, session?.user.id, {
            page: 1,
            pageSize: NOTIFICATIONS_PAGE_SIZE,
          }),
        ]}
      >
        <NotificationsPage />
      </PrefetchedQueries>
    </PageContainer>
  );
}
