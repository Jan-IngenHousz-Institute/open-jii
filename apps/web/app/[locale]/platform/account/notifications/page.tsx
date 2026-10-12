import type { Metadata } from "next";
import { NotificationPreferencesCard } from "~/components/account-settings/notification-preferences-card";

import initTranslations from "@repo/i18n/server";

interface NotificationSettingsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: NotificationSettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["notifications"] });

  return { title: t("settings") };
}

export default function NotificationSettingsPage() {
  return <NotificationPreferencesCard />;
}
