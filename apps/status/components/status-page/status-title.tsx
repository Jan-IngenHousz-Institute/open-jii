"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n/client";

export function StatusTitle({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("status");

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-foreground text-3xl font-bold tracking-tight">{t("title")}</h1>
      {children}
    </div>
  );
}
