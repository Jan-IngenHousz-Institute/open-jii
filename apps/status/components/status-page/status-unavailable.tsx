"use client";

import { CloudOff } from "lucide-react";
import { ContactLine } from "~/components/shared/contact-line";

import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";

import { StatusTitle } from "./status-title";

export function StatusUnavailable() {
  const { t } = useTranslation("status");

  return (
    <>
      <StatusTitle />
      <Card padding="none" className="flex-row items-center gap-4 px-6 py-5">
        <CloudOff className="text-status-stale-foreground size-7 shrink-0" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{t("unavailable.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("unavailable.body")}</p>
          <ContactLine i18nKey="unavailable.help" />
        </div>
      </Card>
    </>
  );
}
