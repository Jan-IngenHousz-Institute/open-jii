"use client";

import { BookOpen } from "lucide-react";
import { env } from "~/env";

import { useTranslation } from "@repo/i18n";

import { sidebarUtilityRow } from "./sidebar-utility-row";

export function DocsNavLink() {
  const { t } = useTranslation();
  const label = t("navigation.documentation");
  const newTabHint = t("docsHelp.opensNewTab");

  return (
    <a
      href={env.NEXT_PUBLIC_DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (${newTabHint})`}
      title={label}
      className={sidebarUtilityRow()}
    >
      <BookOpen className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </a>
  );
}
