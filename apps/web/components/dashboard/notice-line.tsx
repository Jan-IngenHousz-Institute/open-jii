"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";

interface NoticeLineProps {
  children: ReactNode;
  onDismiss: () => void;
}

/** One line above the home's sections that stays until the reader closes it. */
export function NoticeLine({ children, onDismiss }: NoticeLineProps) {
  const { t } = useTranslation();

  return (
    <div className="border-status-active-foreground/30 bg-status-active text-status-active-foreground flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm">
      <p className="min-w-0">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dashboard.dismiss")}
        className="text-muted-foreground hover:text-foreground text-base leading-none"
      >
        &times;
      </button>
    </div>
  );
}
