"use client";

import { OrcidIdLink } from "@/components/people/orcid-id";
import { SettingsCard } from "@/components/shared/settings-card";
import { useLocale } from "@/hooks/useLocale";
import { IdCard } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function OrcidIdCard({ orcidId }: { orcidId: string | null }) {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const securityPath = `/${locale}/platform/account/security`;

  if (!orcidId) {
    return (
      <SettingsCard
        icon={IdCard}
        title={t("settings.OrcidIdCard.title")}
        description={t("settings.OrcidIdCard.notConnectedDescription")}
        action={
          <Button asChild>
            <Link href={securityPath}>{t("settings.OrcidIdCard.connect")}</Link>
          </Button>
        }
      >
        <p className="text-muted-foreground text-xs">
          {t("settings.OrcidIdCard.notConnectedHelp")}
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      icon={IdCard}
      title={t("settings.OrcidIdCard.title")}
      description={t("settings.OrcidIdCard.connectedDescription")}
      action={
        <Button asChild variant="link" size="inline" className="align-top">
          <Link href={securityPath}>{t("settings.OrcidIdCard.manageInSecurity")}</Link>
        </Button>
      }
    >
      <div className="space-y-2">
        <OrcidIdLink orcidId={orcidId} />
        <p className="text-muted-foreground text-xs">{t("settings.OrcidIdCard.help")}</p>
      </div>
    </SettingsCard>
  );
}
