import { guestMayUse } from "@/components/auth/guest-access";
import { PageContainer } from "@/components/page-container";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { notificationsListQuery } from "@/hooks/notifications/useNotifications/notifications-list-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

export default async function NotificationsRoute({ params }: NotificationsRouteProps) {
  const session = await auth();
  if (!guestMayUse("notifications.listNotifications", session?.user.isAnonymous === true)) {
    redirect(`/${(await params).locale}/platform`);
  }

  return (
    <PageContainer width="reading">
      <PrefetchedQueries
        queries={(utils) => [
          // The page's unfiltered first view exactly, or the browser asks again under another key.
          notificationsListQuery(utils, session?.user.id, { readState: "all", page: 1 }),
        ]}
      >
        <NotificationsPage />
      </PrefetchedQueries>
    </PageContainer>
  );
}
