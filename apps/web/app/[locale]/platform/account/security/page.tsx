import type { Metadata } from "next";
import { Suspense } from "react";
import { PasskeysCard } from "~/components/account-settings/passkeys/passkeys-card";
import { ConnectResultBanner } from "~/components/account-settings/security/connect-result-banner";
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
      {/* The banner reads the search parameters, which need a boundary of their own. */}
      <Suspense fallback={null}>
        <ConnectResultBanner />
      </Suspense>
      <SignInMethodsCard />
      <PasskeysCard />
    </div>
  );
}
