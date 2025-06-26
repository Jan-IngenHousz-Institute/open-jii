import { SignOutDialog } from "@/components/signout-dialog";

import { initTranslations } from "@repo/i18n";
import type { Locale } from "@repo/i18n";

interface SignOutPageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    backUrl?: string;
  }>;
}

export default async function SignOutPage({ params, searchParams }: SignOutPageProps) {
  const { locale } = await params;
  const { backUrl } = await searchParams;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const translations = {
    title: t("signout.title"),
    description: t("signout.description"),
    cancel: t("common.cancel"),
    confirm: t("signout.confirm"),
  };

  return <SignOutDialog backUrl={backUrl ?? `/${locale}/platform`} translations={translations} />;
}
