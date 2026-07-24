import type { Metadata } from "next";
import { ApiKeysCard } from "~/components/account-settings/api-keys/api-keys-card";

import initTranslations from "@repo/i18n/server";

interface ApiKeysPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ApiKeysPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["account"] });

  return { title: t("apiKeys.title") };
}

export default function ApiKeysPage() {
  return <ApiKeysCard />;
}
