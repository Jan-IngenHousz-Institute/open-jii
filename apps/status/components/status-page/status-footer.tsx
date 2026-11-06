"use client";

import { useTranslation } from "@repo/i18n/client";

export function StatusFooter() {
  const { t } = useTranslation("status");

  return (
    <footer className="mx-auto w-full max-w-4xl px-4 pb-12 md:px-8">
      <p className="text-muted-foreground text-sm">{t("footer")}</p>
    </footer>
  );
}
