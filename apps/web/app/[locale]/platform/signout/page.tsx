import { SignOutDialog } from "@/components/signout-dialog";

import { initTranslations } from "@repo/i18n";
import type { Locale } from "@repo/i18n";

interface SignOutPageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ hideBackground?: string }>;
}

export default async function SignOutPage({ params, searchParams }: SignOutPageProps) {
  const { locale } = await params;
  const { hideBackground } = await searchParams;

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

  // Show backdrop overlay when hideBackground=true (triggered from unified nav)
  const shouldHideBackground = hideBackground === "true";

  return (
    <>
      {shouldHideBackground && <div className="fixed inset-0 z-40 bg-black" />}
      <SignOutDialog translations={translations} />
    </>
  );
}
