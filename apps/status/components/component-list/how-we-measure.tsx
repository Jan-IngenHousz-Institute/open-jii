"use client";

import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";

export function HowWeMeasure() {
  const { t } = useTranslation("status");

  return (
    <Card padding="none" className="gap-2 px-6 py-5 text-sm">
      <h2 className="font-semibold">{t("howWeMeasure.title")}</h2>
      <p className="text-muted-foreground max-w-prose">{t("howWeMeasure.states")}</p>
      <p className="text-muted-foreground max-w-prose">{t("howWeMeasure.checks")}</p>
      <p className="text-muted-foreground max-w-prose">{t("howWeMeasure.uptime")}</p>
    </Card>
  );
}
