import type { Metadata } from "next";
import { auth } from "~/app/actions/auth";
import { AccountSettings } from "~/components/account-settings/account-settings";

import initTranslations from "@repo/i18n/server";

interface AccountPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AccountPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["account"] });

  return { title: t("tabs.general") };
}

export default async function AccountPage() {
  const session = await auth();

  return <AccountSettings session={session} />;
}
