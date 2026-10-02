import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";
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

export default function NotificationsRoute() {
  return (
    <PageContainer width="reading">
      <NotificationsPage />
    </PageContainer>
  );
}
