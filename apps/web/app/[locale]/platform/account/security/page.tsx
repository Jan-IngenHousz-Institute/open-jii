import type { Metadata } from "next";
import { PasskeysCard } from "~/components/account-settings/passkeys/passkeys-card";
import { SignInMethodsCard } from "~/components/account-settings/security/sign-in-methods-card";

import initTranslations from "@repo/i18n/server";

interface SecurityPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: SecurityPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["account"] });

  return { title: t("security.title") };
}

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <SignInMethodsCard />
      <PasskeysCard />
    </div>
  );
}
