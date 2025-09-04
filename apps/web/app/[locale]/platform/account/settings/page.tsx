import { auth } from "@/lib/auth";
import { AccountSettings } from "~/components/account-settings/account-settings";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

export default async function AccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const session = await auth();
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["account"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("settings.accountsettings")}</h3>
        <p className="text-muted-foreground text-sm">{t("settings.description")}</p>
      </div>
      <AccountSettings session={session} />
    </div>
  );
}
